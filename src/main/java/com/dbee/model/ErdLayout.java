package com.dbee.model;

import java.util.HashMap;
import java.util.Map;

/**
 * ERD layout: node positions + view state, saved per (connectionId, schema).
 */
public class ErdLayout {
    private int version = 1;
    private double zoom = 1.0;
    private Position pan = new Position(0, 0);
    private Map<String, Position> positions = new HashMap<>();
    private String updatedAt;

    public int getVersion() { return version; }
    public void setVersion(int version) { this.version = version; }

    public double getZoom() { return zoom; }
    public void setZoom(double zoom) { this.zoom = zoom; }

    public Position getPan() { return pan; }
    public void setPan(Position pan) { this.pan = pan; }

    public Map<String, Position> getPositions() { return positions; }
    public void setPositions(Map<String, Position> positions) { this.positions = positions; }

    public String getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(String updatedAt) { this.updatedAt = updatedAt; }

    public static class Position {
        private double x;
        private double y;

        public Position() {}
        public Position(double x, double y) {
            this.x = x;
            this.y = y;
        }

        public double getX() { return x; }
        public void setX(double x) { this.x = x; }

        public double getY() { return y; }
        public void setY(double y) { this.y = y; }
    }
}
