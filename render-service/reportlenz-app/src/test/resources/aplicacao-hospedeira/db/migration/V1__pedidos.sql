-- Migração da APLICAÇÃO hospedeira (teste do ADR-026): mesma numeração V1/V2 do ReportLenz.
CREATE TABLE pedido_da_aplicacao (id INTEGER PRIMARY KEY, descricao TEXT);
