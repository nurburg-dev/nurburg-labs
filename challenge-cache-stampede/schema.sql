CREATE TABLE IF NOT EXISTS products (
  id          SERIAL PRIMARY KEY,
  name        TEXT           NOT NULL,
  description TEXT,
  price       NUMERIC(10, 2) NOT NULL
);

INSERT INTO products (name, description, price) VALUES
  ('Wireless Noise-Cancelling Headphones', 'Over-ear headphones with 30-hour battery and active noise cancellation', 299.99),
  ('Mechanical Keyboard', 'Tenkeyless layout with Cherry MX Brown switches and RGB backlight', 129.99),
  ('USB-C Hub 7-in-1', 'HDMI 4K, 3x USB-A, SD card reader, 100W PD pass-through', 49.99),
  ('Ultrawide Monitor 34"', '3440x1440 IPS panel, 144 Hz, 1ms response time', 749.99),
  ('Ergonomic Office Chair', 'Lumbar support, 4D armrests, breathable mesh back', 459.99),
  ('Portable SSD 1TB', 'USB 3.2 Gen 2, 1050 MB/s read, shock resistant', 89.99),
  ('Webcam 4K', 'Auto-focus, built-in ring light, 90° field of view', 119.99),
  ('Standing Desk Converter', 'Sit-stand riser, 80cm wide, holds up to 15 kg', 199.99),
  ('LED Desk Lamp', 'Colour temperature 2700–6500 K, wireless charging base', 59.99),
  ('Laptop Stand Adjustable', 'Aluminium, foldable, fits 10–17" laptops', 34.99)
ON CONFLICT DO NOTHING;
