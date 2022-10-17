import fs from 'fs';
import request from 'request';
import * as Utils from './Utils.js';

var rigsIDsBackup = [];

const apiKey    = '98ca9a35a41ccce319a5d87efe9c3f861d55f90dcd438f30c6cf91ddc8eff27f';
const apiSecret = '5b9308f41c033d725b409356a5c002f70e697dbe4465a9bad39347e6d1e8ffbe';
const apiUrl    = 'https://www.miningrigrentals.com/api/v2';
const poolProfile = 194467;

export function getRentedRigs()
{
    return new Promise(async (resolve, reject) =>
    {
        var rentedRigs = [];
        var totalRented = await getTotalRentedRigs();

        for(let i = 0; i < Math.ceil(totalRented / 25); i++)
        {
            const rigsData = await getRentedRig(i * 25, 25);

            for(let i = 0; i < rigsData.rentals.length; i++)
                if(rigsData.rentals[i].rig.type === 'ethash')           
                    rentedRigs.push(rigsData.rentals[i]);
        }

        resolve(rentedRigs);
    });
}

function getRentedRig(start, limit)
{
    return new Promise((resolve, reject) =>
    {
        var apiEnd = '/rental';

        request(apiUrl + apiEnd, authHeader(apiEnd, 'GET', { start: start, limit: limit }), (error, response, body) =>
        {
            if(error)
                return Utils.log(`getMyRentals error (0): ${ error }`, 'error');

            if(body.success)
                resolve(body.data);
            else
                Utils.log(`getMyRentals error (1): ${ JSON.stringify(body) }`, 'error');
        });
    });
}

function getTotalRentedRigs()
{
    return new Promise((resolve, reject) =>
    {
        var apiEnd = '/rental';

        request(apiUrl + apiEnd, authHeader(apiEnd, 'GET', { start: 1, limit: 1 }), (error, response, body) =>
        {
            if(error)
                return Utils.log(`getTotalRentedRigs error (0): ${ error }`, 'error');

            if(body.success)
                resolve(body.data.total);
            else
                Utils.log(`getTotalRentedRigs error (1): ${ JSON.stringify(body) }`, 'error');
        });
    });
}

export function getRigsToRent()
{
    return new Promise((resolve, reject) =>
    {
        function isBadRigID(id)
        {
            for(let i = 0; i < badRigs.length; i++)
                if(badRigs[i] == id)
                    return true;
            return false;
        }

        var rigsIDs;
        var badRigs;

        try
        {
            rigsIDs = JSON.parse(fs.readFileSync('./Json/Rigs.json'));
            badRigs = JSON.parse(fs.readFileSync('./Json/Bad_Rigs.json'));
            rigsIDsBackup = rigsIDs;
        }
        catch(e)
        {
            Utils.log(`getRigsToRent error: ${ e }`, 'error');
            rigsIDs = false;
        }

        if(!rigsIDs)
            rigsIDs = rigsIDsBackup;

        if(rigsIDs.length == 1) return Utils.log(`getRigsToRent error (0): minimum of 2 rigs required in 'Rigs.json'`, 'error');

        const t = Utils.getTickCount();
        
        var apiEnd = '/rig/'

        for(let i = 0; i < rigsIDs.length; i++)
        {
            const id = rigsIDs[i];

            if(!isBadRigID(id))
                apiEnd = apiEnd + '' + id.toString() + ';';
        }

        request(apiUrl + apiEnd, authHeader(apiEnd, 'GET'), (error, response, body) =>
        {
            if(error)
                return Utils.log('getRigsToRent error (0): ' + error, 'error');

            try
            {
                const data = JSON.parse(body);
                if(data.success)
                    resolve(data.data);
                else
                {
                    resolve(false);
                    Utils.log('getRigsToRent error (1): ' + JSON.stringify(body), 'error');
                }
            }
            catch(e)
            {
                Utils.log('getRigsToRent error (2): ' + e, 'error');
            }
        });
    });
}

export function getBtcBalance()
{
    return new Promise((resolve, reject) =>
    {
        var apiEnd = '/account/balance';

        request(apiUrl + apiEnd, authHeader(apiEnd, 'GET'), (error, response, body) =>
        {
            if(error)
                return Utils.log(`getBtcBalance error (0): ${ error }`, 'error');

            resolve(JSON.parse(body).data.BTC);
        });
    }); 
}

export function getBtcPrice()
{
    return new Promise((resolve, reject) =>
    {
        request.get('https://api.coinstats.app/public/v1/coins/bitcoin', (error, response, body) =>
        {
            if(error)
                return Utils.log(`getBtcPrice error (0): ${ error }`, 'error');

            resolve(Math.floor(JSON.parse(body).coin.price));
        });
    });
}

export function getEthPrice()
{
    return new Promise((resolve, reject) =>
    {
        request.get('https://api.coinstats.app/public/v1/coins/ethereum', (error, response, body) =>
        {
            if(error)
                return Utils.log(`getEthPrice error (0): ${ error }`, 'error');

            resolve(Math.floor(JSON.parse(body).coin.price));
        });
    });
}

export function getDailyReward(ethPrice)
{
    return new Promise((resolve, reject) =>
    {
        request.get('https://api.flexpool.io/v2/pool/dailyRewardPerGigahashSec?coin=eth', (error, response, body) =>
        {
            if(error)
                return Utils.log(`getDailyReward error (0): ${ error }`, 'error');

            resolve(((JSON.parse(body).result / 1000000000000000000) / 1000) * ethPrice);
        });
    });
}

export function rentRig(rigid, hours)
{
    return new Promise((resolve, reject) =>
    {
        var apiEnd = '/rental';

        const rigdata =
        {
            rig: rigid,
            length: hours,
            profile: poolProfile
        }

        request(apiUrl + apiEnd, authHeader(apiEnd, 'PUT', rigdata), (error, response, body) =>
        {
            if(error)
                return Utils.log(`rentRig error (0): ${ error }`, 'error');

            if(body.success)
                resolve(true);
            else
            {
                Utils.log(`rentRig error (1): ${ JSON.stringify(body) }`, 'error');
                resolve(false);
            } 
        });
    });
}

function authHeader(apiEnd, method, json)
{
    const nonce = Utils.getNonce();
    return {
        method: method,
        headers:
        {
            'User-Agent': 'request',
            'x-api-sign': Utils.signHMAC(apiKey + nonce + apiEnd, apiSecret),
            'x-api-key': apiKey,
            'x-api-nonce': nonce
        },
        json: json
    };
}