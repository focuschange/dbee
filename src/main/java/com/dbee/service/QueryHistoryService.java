package com.dbee.service;

import com.dbee.config.QueryHistoryConfig;
import com.dbee.model.QueryHistory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
public class QueryHistoryService {
    private final QueryHistoryConfig historyConfig;

    public QueryHistoryService(QueryHistoryConfig historyConfig) {
        this.historyConfig = historyConfig;
    }

    public void addHistory(QueryHistory entry) {
        String dateKey = QueryHistoryConfig.toDateKey(entry.getExecutedAt());
        List<QueryHistory> daily = historyConfig.loadDate(dateKey);
        daily.addFirst(entry);
        historyConfig.saveDate(dateKey, daily);
    }

    public List<QueryHistory> listHistory(String search, int limit) {
        List<String> dateKeys = historyConfig.listDateKeys();
        List<QueryHistory> result = new ArrayList<>();
        int effectiveLimit = limit > 0 ? limit : 200;

        for (String dateKey : dateKeys) {
            List<QueryHistory> daily = historyConfig.loadDate(dateKey);
            for (QueryHistory h : daily) {
                if (search != null && !search.isBlank()) {
                    String keyword = search.toLowerCase();
                    boolean matches =
                            (h.getSql() != null && h.getSql().toLowerCase().contains(keyword)) ||
                            (h.getConnectionName() != null && h.getConnectionName().toLowerCase().contains(keyword));
                    if (!matches) continue;
                }
                result.add(h);
                if (result.size() >= effectiveLimit) break;
            }
            if (result.size() >= effectiveLimit) break;
        }

        result.sort(Comparator.comparingLong(QueryHistory::getExecutedAt).reversed());
        return result;
    }

    public void deleteHistory(String id) {
        List<String> dateKeys = historyConfig.listDateKeys();
        for (String dateKey : dateKeys) {
            List<QueryHistory> daily = historyConfig.loadDate(dateKey);
            int sizeBefore = daily.size();
            daily.removeIf(h -> h.getId().equals(id));
            if (daily.size() < sizeBefore) {
                historyConfig.saveDate(dateKey, daily);
                return;
            }
        }
    }

    public void clearHistory() {
        historyConfig.clearAll();
    }
}
