package com.dbee.export;

import com.dbee.model.QueryResult;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.streaming.SXSSFWorkbook;

import java.io.IOException;
import java.io.OutputStream;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

public class XlsxExporter implements Exporter {

    @Override
    public void export(QueryResult result, Path path) throws IOException {
        try (OutputStream out = Files.newOutputStream(path)) {
            export(result, out);
        }
    }

    public void export(QueryResult result, OutputStream out) throws IOException {
        try (SXSSFWorkbook workbook = new SXSSFWorkbook(100)) {
            Sheet sheet = workbook.createSheet("Query Result");
            List<String> cols = result.getColumnNames();

            // Header row with bold style
            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            Row headerRow = sheet.createRow(0);
            for (int i = 0; i < cols.size(); i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(cols.get(i));
                cell.setCellStyle(headerStyle);
            }

            // Data rows
            int rowNum = 1;
            for (Object[] row : result.getRows()) {
                Row dataRow = sheet.createRow(rowNum++);
                for (int i = 0; i < row.length; i++) {
                    Cell cell = dataRow.createCell(i);
                    setCellValue(cell, row[i]);
                }
            }

            workbook.write(out);
        }
    }

    private void setCellValue(Cell cell, Object val) {
        if (val == null) {
            cell.setBlank();
            return;
        }
        if (val instanceof Number num) {
            cell.setCellValue(num.doubleValue());
        } else if (val instanceof Boolean b) {
            cell.setCellValue(b);
        } else if (val instanceof java.sql.Timestamp ts) {
            cell.setCellValue(ts.toString());
        } else if (val instanceof java.sql.Date d) {
            cell.setCellValue(d.toString());
        } else if (val instanceof byte[]) {
            cell.setCellValue("[BINARY]");
        } else {
            cell.setCellValue(val.toString());
        }
    }

    @Override public String getFileExtension() { return "xlsx"; }
    @Override public String getDescription() { return "Excel Files"; }
}
