package com.dbee.controller;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class QueryControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void contextLoads() {
        // Verify Spring context starts successfully
    }

    @Test
    void staticResourcesServed() throws Exception {
        mockMvc.perform(get("/index.html"))
                .andExpect(status().isOk());
    }

    @Test
    void apiConnectionsList() throws Exception {
        mockMvc.perform(get("/api/connections"))
                .andExpect(status().isOk());
    }

    @Test
    void apiHistoryList() throws Exception {
        mockMvc.perform(get("/api/history"))
                .andExpect(status().isOk());
    }

    @Test
    void apiLlmProviders() throws Exception {
        mockMvc.perform(get("/api/llm/providers"))
                .andExpect(status().isOk());
    }

    @Test
    void apiSecurityStatus() throws Exception {
        mockMvc.perform(get("/api/security/status"))
                .andExpect(status().isOk());
    }
}
