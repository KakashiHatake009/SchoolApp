-- Creates keycloak database
-- This runs automatically when postgres container starts for the first time

CREATE DATABASE keycloak_dev;
GRANT ALL PRIVILEGES ON DATABASE keycloak_dev TO schoolapp;

\c keycloak_dev
GRANT ALL ON SCHEMA public TO schoolapp;