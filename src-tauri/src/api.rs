use crate::auth::{self, Tokens};
use crate::GradeRow;
use reqwest::StatusCode;
use serde_json::Value;
use std::time::Duration;

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

fn first_string(values: &[Option<String>]) -> String {
    values.iter().find_map(|v| v.clone()).unwrap_or_default()
}

impl MagisterClient {
    pub async fn new(tokens: Tokens) -> Result<Self, String> {
        let mut c = Self {
            http: reqwest::Client::new(),
            tokens,
            base: String::new(),
        };
        let meta = c
            .get_json("https://magister.net/.well-known/host-meta.json?rel=magister-api")
            .await?;
        let href = meta["links"][0]["href"]
            .as_str()
            .ok_or("Could not find school API host")?;
        let u = url::Url::parse(href).map_err(|e| e.to_string())?;
        c.base = format!("{}://{}", u.scheme(), u.host_str().unwrap_or_default());
        Ok(c)
    }

    /// GET with Bearer auth, refresh once on 401, and retry transient network failures.
    async fn get_json(&mut self, url: &str) -> Result<Value, String> {
        let mut net_tries = 0;
        let mut refreshed = false;
        loop {
            let res = match self
                .http
                .get(url)
                .bearer_auth(&self.tokens.access_token)
                .send()
                .await
            {
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
        let pid = account["Persoon"]["Id"]
            .as_i64()
            .ok_or("No student ID in account")?;

        let years = self
            .get_json(&format!("{b}/api/leerlingen/{pid}/aanmeldingen?begin=1970-01-01"))
            .await?;
        let items = years["items"]
            .as_array()
            .cloned()
            .unwrap_or_default();
        if items.is_empty() {
            return Err("No school years found".into());
        }

        // Gemairo selects the first school year returned by Magister.
        let year = &items[0];
        let yid = year["id"].as_i64().ok_or("School year without id")?;
        let end = year["einde"].as_str().ok_or("School year without end date")?;

        let grades = self
            .get_json(&format!(
                "{b}/api/personen/{pid}/aanmeldingen/{yid}/cijfers/cijferoverzichtvooraanmelding?actievePerioden=false&alleenBerekendeKolommen=false&alleenPTAKolommen=false&peildatum={end}"
            ))
            .await?;
        let list = grades["Items"]
            .as_array()
            .or(grades["items"].as_array())
            .cloned()
            .unwrap_or_default();

        let mut rows = Vec::new();
        for g in list
            .iter()
            .filter(|g| g["CijferKolom"]["KolomSoort"].as_i64() == Some(1))
        {
            let col = g["CijferKolom"]["Id"].as_i64().unwrap_or_default();

            // Gemairo's grade translation uses the grade row and nested column first.
            // The extra-info endpoint supplements missing labels/weights only.
            let extra = if col != 0 {
                self.get_json(&format!(
                    "{b}/api/personen/{pid}/aanmeldingen/{yid}/cijfers/extracijferkolominfo/{col}"
                ))
                .await
                .unwrap_or(Value::Null)
            } else {
                Value::Null
            };

            let vak = &g["Vak"];
            let title = first_string(&[
                s(&g["omschrijving"]),
                s(&g["kolom"]["omschrijving"]),
                s(&g["CijferKolom"]["KolomOmschrijving"]),
                s(&extra["WerkInformatieOmschrijving"]),
                s(&extra["KolomOmschrijving"]),
            ]);
            let weight = first_string(&[
                s(&g["kolom"]["weegfactor"]),
                s(&g["CijferKolom"]["Weging"]),
                s(&g["weegfactor"]),
                s(&extra["Weging"]),
            ]);

            rows.push(GradeRow {
                course: first_string(&[
                    s(&vak["Omschrijving"]),
                    s(&vak["omschrijving"]),
                    s(&vak["Naam"]),
                    s(&g["vak"]["Omschrijving"]),
                    s(&g["vak"]["omschrijving"]),
                    s(&g["vak"]["Naam"]),
                ]),
                title,
                grade: first_string(&[s(&g["CijferStr"]), s(&g["waarde"])]),
                weight,
            });
        }

        Ok(rows)
    }
}
