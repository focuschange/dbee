package com.dbee.controller;

import com.dbee.model.NoteInfo;
import com.dbee.service.NoteService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/notes")
public class NoteController {
    private final NoteService noteService;

    public NoteController(NoteService noteService) {
        this.noteService = noteService;
    }

    @GetMapping
    public List<NoteInfo> list() {
        return noteService.listNotes();
    }

    @GetMapping("/{id}")
    public NoteInfo get(@PathVariable String id) {
        return noteService.getNote(id);
    }

    @PostMapping
    public NoteInfo create(@RequestBody NoteInfo info) {
        return noteService.addNote(info);
    }

    @PutMapping("/{id}")
    public NoteInfo update(@PathVariable String id, @RequestBody NoteInfo info) {
        return noteService.updateNote(id, info);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        noteService.deleteNote(id);
        return ResponseEntity.noContent().build();
    }
}
