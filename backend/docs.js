const express = require('express');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');

const spec = YAML.load(path.join(__dirname, '..', 'openapi.yaml'));

module.exports = function (app) {
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec));
};
