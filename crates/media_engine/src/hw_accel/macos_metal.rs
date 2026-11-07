pub struct MetalHardwareDevice {
    pub device_name: String,
}

impl Default for MetalHardwareDevice {
    fn default() -> Self {
        Self {
            device_name: "Apple Metal VideoToolbox".into(),
        }
    }
}

