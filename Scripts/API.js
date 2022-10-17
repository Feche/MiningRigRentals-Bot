import express from 'express';
import cors from 'cors';
import * as Utils from './Utils.js';

const app = express();

app.use(cors());

const API_PORT = 3001;

export default function startAPI()
{
    app.get('/api/', apiSendData);

    app.listen(API_PORT, () => 
    { 
        Utils.log(`API started at port ${ API_PORT }`);
    });
}

function apiSendData(req, res)
{
    res.send(JSON.stringify(global.Rigs));
}