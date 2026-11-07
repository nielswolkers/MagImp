use crate::auth::{self, Tokens};
use crate::GradeRow;
use reqwest::StatusCode;
use serde_json::Value;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const MAX_NETWORK_RETRIES: u32 = 3;

pub struct MagisterClient {
    http: reqwest::Client,
    tokens: Tokens,
    base: String,
}

fn s(v: &Value) -> Option<String> {
    match v {
        Value::String(x) if !x.trim().is_empty() => Some(x.clone()),
        Value::Number(n) => Some(n.to_string()),
        _ => None,
    }
}

fn today() -> String {
    // yyyy-mm-dd from unix days (civil-from-days algorithm)
    let days = (SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() / 86400) as i64;
    let z = days + 719468;
    let era = z.div_euclid(146097);
    let doe = z - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = yoe + era * 400 + if m <= 2 { 1 } else { 0 };
    format!("{y:04}-{m:02}-{d:02}")
}

impl MagisterClient {
    pub async fn new(tokens: Tokens) -> Result<Self, String> {
        let mut c = Self { http: reqwest::Client::new(), tokens, base: String::new() };
        let meta = c
            .get_json("https://magister.net/.well-known/host-meta.json?rel=magister-api")
            .await?;
        let href = meta["links"][0]["href"].as_str().ok_or("Could not find school API host")?;
        let u = url::Url::parse(href).map_err(|e| e.to_string())?;
        c.base = format!("{}://{}", u.scheme(), u.host_str().unwrap_or_default());
        Ok(c)
    }

    /// GET with Bearer auth, 401 -> refresh, 429 -> wait secondsLeft + 1, network retries.
    async fn get_json(&mut self, url: &str) -> Result<Value, String> {
        let mut net_tries = 0;
        let mut refreshed = false;
        loop {
            let res = match self.http.get(url).bearer_auth(&self.tokens.access_token).send().await {
                Ok(r) => r,
                Err(e) => {
                    net_tries += 1;
                    if net_tries > MAX_NETWORK_RETRIES {
                        return Err(format!("Network error: {e}"));
                    }
                    tokio::time::sleep(Duration::from_secs(net_tries as u64)).await;
                    continue;
                }
            };
            match res.status() {
                StatusCode::TOO_MANY_REQUESTS => {
                    let body: Value = res.json().await.unwrap_or(Value::Null);
                    let secs = body["secondsLeft"].as_u64().unwrap_or(1);
                    tokio::time::sleep(Duration::from_secs(secs + 1)).await;
                }
                StatusCode::UNAUTHORIZED if !refreshed => {
                    let rt = self.tokens.refresh_token.clone().ok_or("Session expired")?;
                    let new = auth::refresh(&rt).await?;
                    self.tokens = Tokens {
                        refresh_token: new.refresh_token.clone().or(Some(rt)),
                        ..new
                    };
                    refreshed = true;
                }
                st if st.is_success() => return res.json().await.map_err(|e| e.to_string()),
                st => {
                    let body = res.text().await.unwrap_or_default();
                    return Err(format!("Magister returned {st} for {url}: {body}"));
                }
            }
        }
    }

    pub async fn fetch_grades(&mut self) -> Result<Vec<GradeRow>, String> {
        let b = self.base.clone();
        let account = self.get_json(&format!("{b}/api/account")).await?;
        let pid = account["Persoon"]["Id"].as_i64().ok_or("No student ID in account")?;

        let years = self
            .get_json(&format!("{b}/api/leerlingen/{pid}/aanmeldingen?begin=1970-01-01"))
            .await?;
        let items = years["items"].as_array().cloned().unwrap_or_default();
        if items.is_empty() {
            return Err("No school years found".into());
        }
        // Gemairo default: the year containing today, else the most recent one.
        let now = today();
        let date = |v: &Value, k: &str| v[k].as_str().unwrap_or("").chars().take(10).collect::<String>();
        let year = items
            .iter()
            .find(|y| date(y, "begin") <= now && now <= date(y, "einde"))
            .or_else(|| items.iter().max_by_key(|y| date(y, "einde")))
            .unwrap()
            .clone();
        let yid = year["id"].as_i64().ok_or("School year without id")?;
        let end = year["einde"].as_str().unwrap_or("").to_string();

        let grades = self
            .get_json(&format!(
                "{b}/api/personen/{pid}/aanmeldingen/{yid}/cijfers/cijferoverzichtvooraanmelding?actievePerioden=false&alleenBerekendeKolommen=false&alleenPTAKolommen=false&peildatum={end}"
            ))
            .await?;
        let list = grades["Items"].as_array().or(grades["items"].as_array()).cloned().unwrap_or_default();

        let mut rows = Vec::new();
        for g in list.iter().filter(|g| g["CijferKolom"]["KolomSoort"].as_i64() == Some(1)) {
            let col = g["CijferKolom"]["Id"].as_i64().unwrap_or_default();
            let extra = self
                .get_json(&format!("{b}/api/personen/{pid}/aanmeldingen/{yid}/cijfers/extracijferkolominfo/{col}"))
                .await
                .unwrap_or(Value::Null);
            let vak = &g["Vak"];
            rows.push(GradeRow {
                course: s(&vak["Omschrijving"]).or(s(&vak["omschrijving"])).or(s(&vak["Naam"])).unwrap_or_default(),
                title: s(&extra["WerkInformatieOmschrijving"]).or(s(&extra["KolomOmschrijving"])).unwrap_or_default(),
                grade: s(&g["CijferStr"]).or(s(&g["waarde"])).unwrap_or_default(),
                weight: s(&extra["Weging"]).unwrap_or_default(),
            });
        }
        Ok(rows)
    }
}
