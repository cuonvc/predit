use crate::config::UiLanguage;
use serde_json::Value;

const EN_JSON: &str = include_str!("../../../assets/locales/en.json");
const VI_JSON: &str = include_str!("../../../assets/locales/vi.json");

pub struct I18n {
    en: Value,
    vi: Value,
}

impl Default for I18n {
    fn default() -> Self {
        Self::new()
    }
}

impl I18n {
    pub fn new() -> Self {
        let en = serde_json::from_str(EN_JSON).unwrap_or(Value::Null);
        let vi = serde_json::from_str(VI_JSON).unwrap_or(Value::Null);
        Self { en, vi }
    }

    pub fn t(&self, lang: UiLanguage, key: &str) -> String {
        let root = match lang {
            UiLanguage::En => &self.en,
            UiLanguage::Vi => &self.vi,
        };
        let mut cur = root;
        for part in key.split('.') {
            if let Some(next) = cur.get(part) {
                cur = next;
            } else {
                return key.to_string();
            }
        }
        cur.as_str().unwrap_or(key).to_string()
    }
}

