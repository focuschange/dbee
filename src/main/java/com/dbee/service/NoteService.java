package com.dbee.service;

import com.dbee.config.NoteConfig;
import com.dbee.model.NoteInfo;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class NoteService {
    private final NoteConfig noteConfig;
    private final List<NoteInfo> notes;

    public NoteService(NoteConfig noteConfig) {
        this.noteConfig = noteConfig;
        this.notes = new ArrayList<>(noteConfig.load());
    }

    public List<NoteInfo> listNotes() {
        return List.copyOf(notes);
    }

    public NoteInfo getNote(String id) {
        return notes.stream()
                .filter(n -> n.getId().equals(id))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Note not found: " + id));
    }

    public NoteInfo addNote(NoteInfo info) {
        notes.add(info);
        noteConfig.save(notes);
        return info;
    }

    public NoteInfo updateNote(String id, NoteInfo info) {
        for (int i = 0; i < notes.size(); i++) {
            if (notes.get(i).getId().equals(id)) {
                info.setId(id);
                info.setCreatedAt(notes.get(i).getCreatedAt());
                info.setUpdatedAt(System.currentTimeMillis());
                notes.set(i, info);
                noteConfig.save(notes);
                return info;
            }
        }
        throw new IllegalArgumentException("Note not found: " + id);
    }

    public void deleteNote(String id) {
        notes.removeIf(n -> n.getId().equals(id));
        noteConfig.save(notes);
    }
}
