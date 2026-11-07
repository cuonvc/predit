pub struct Dx11HardwareDevice {
    pub adapter_name: String,
}

impl Default for Dx11HardwareDevice {
    fn default() -> Self {
        Self {
            adapter_name: "Direct3D11 Hardware Video Acceleration".into(),
        }
    }
}

