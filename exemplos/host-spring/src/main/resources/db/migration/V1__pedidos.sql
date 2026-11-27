-- Migrações DA APLICAÇÃO (mesma numeração V1/V2 do ReportLenz, de propósito).
CREATE TABLE pedido (id INTEGER PRIMARY KEY, cliente TEXT NOT NULL, valor NUMERIC NOT NULL);
