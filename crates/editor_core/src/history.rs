use crate::project::TimelineState;

const MAX_HISTORY_STEPS: usize = 64;

#[derive(Debug, Clone)]
pub struct TimelineHistory {
    past: Vec<TimelineState>,
    pub present: TimelineState,
    future: Vec<TimelineState>,
}

impl Default for TimelineHistory {
    fn default() -> Self {
        Self::new(TimelineState::default())
    }
}

impl TimelineHistory {
    pub fn new(initial: TimelineState) -> Self {
        Self {
            past: Vec::new(),
            present: initial,
            future: Vec::new(),
        }
    }

    /// Mutates the timeline state and records the previous snapshot on the undo stack.
    pub fn mutate<F>(&mut self, op: F)
    where
        F: FnOnce(&mut TimelineState),
    {
        let snapshot = self.present.clone();
        op(&mut self.present);
        if self.present != snapshot {
            if self.past.len() >= MAX_HISTORY_STEPS {
                self.past.remove(0);
            }
            self.past.push(snapshot);
            self.future.clear();
        }
    }

    /// Mutates transient state (e.g. playhead scrubbing, play/pause) without polluting Undo history.
    pub fn mutate_transient<F>(&mut self, op: F)
    where
        F: FnOnce(&mut TimelineState),
    {
        op(&mut self.present);
    }

    /// Explicitly records the current timeline state onto the Undo stack before a continuous drag/trim interaction.
    pub fn push_snapshot(&mut self) {
        if self.past.last() == Some(&self.present) {
            return;
        }
        if self.past.len() >= MAX_HISTORY_STEPS {
            self.past.remove(0);
        }
        self.past.push(self.present.clone());
        self.future.clear();
    }

    pub fn undo(&mut self) -> bool {
        if let Some(prev) = self.past.pop() {
            let current = std::mem::replace(&mut self.present, prev);
            self.future.push(current);
            true
        } else {
            false
        }
    }

    pub fn redo(&mut self) -> bool {
        if let Some(next) = self.future.pop() {
            let current = std::mem::replace(&mut self.present, next);
            self.past.push(current);
            true
        } else {
            false
        }
    }

    pub fn can_undo(&self) -> bool {
        !self.past.is_empty()
    }

    pub fn can_redo(&self) -> bool {
        !self.future.is_empty()
    }
}

