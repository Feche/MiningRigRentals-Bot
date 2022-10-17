import chalk from 'chalk';
import keypress from 'keypress';
import * as Http from './Http.js';
import * as Utils from './Utils.js';
import * as Rent from './Rent.js';

const decimal = Utils.decimal;
const indent = Utils.indent;

const RentSettings =
{
    minHours: 24,
    maxHours: 48,
    rigUrl: 'http://rig.rent/rigs/',
    minProfit: 0.05,
    totalMinProfit: 0
}

var Rigs =
{
    rented: [],
    toRent: [],
    currenciesPrice:
    {
        btc: 0,
        eth: 0
    },
    balance:
    {
        btc: 0,
        pendingBtc: 0,
        usd: 0,
        pendingUsd: 0
    },
    dailyReward: 0,
    totalProfit: 0,
    usdPerMHs: 0,
    uptimeTick: Utils.getTickCount(),
    infoTick: 0
}

global.Rigs = Rigs;

export default async function Core()
{
    console.clear();

    Utils.log('Rental-bot starting..');

    updateCurrencies();
    checkRigsProfit();

    setInterval(checkRigsProfit, 2500);

    keypress(process.stdin);
}

async function updateRigs()
{
    const t = Utils.getTickCount();

    var rented = await Http.getRentedRigs();
    var rigs = await Http.getRigsToRent();

    if(!rigs) return;

    Rigs.rented = [];
    Rigs.toRent = [];

    /* Rented rigs */
    for(let i = 0; i < rented.length; i++)
    {
        const rig = rented[i];
        const rentHours = rig["length"];
        const costBTC = rig.price.paid;
        const costUSD = rig.price.paid * getCryptoPrice('btc');
        const hashrate = rig.hashrate.advertised.hash * 1000;
        const reward = (hashrate * Rigs.usdPerMHs) * (rentHours / 24);
        const profit = reward - costUSD;

        Rigs.rented.push(
        {
            url: `[${ RentSettings.rigUrl }${ rig.rig.id }]:`,
            id: rig.rig.id,
            status: rig.rig.status.status,
            rentHours: rentHours,
            hoursLeft: rig.rig.status.hours,
            costBTC: costBTC,
            costUSD: costUSD,
            hashrate: hashrate,
            reward: reward,
            profit: profit,
            rawData: rig
        });
    }

    /* Rigs to check for profit */
    for(let i = 0; i < rigs.length; i++)
    {
        const rig = rigs[i];
        const pricePerHour = rig.price.BTC.hour * 1.02;
        const hashrate = rig.hashrate.advertised.hash * 1000;

        var profit;
        var rentHours;
        var costUSD, costBTC;
        var reward;

        if(RentSettings.minHours >= rig.minhours)
            rentHours = RentSettings.minHours;
        else
            rentHours = rig.minhours;
        
        costBTC = rentHours * pricePerHour;
        costUSD = costBTC * getCryptoPrice('btc');

        reward = (hashrate * Rigs.usdPerMHs) * (rentHours / 24);
        profit = reward - costUSD;

        Rigs.toRent.push(
        { 
            url: `[${ RentSettings.rigUrl }${ rig.id }]:`,
            id: rig.id,
            status: rig.status.status,
            hoursLeft: rig.status.hours,
            isRented: rig.status.rented,
            isOnline: rig.status.online,
            optimalDiff: Utils.getDiff(rig.optimal_diff.min),
            costBTC: costBTC,
            costUSD: costUSD,
            rentHours: rentHours,
            hashrate: hashrate,
            reward: reward,
            profit: profit,
            rawData: rig
        });
    }

    Rigs.rented.sort((a, b) => b.profit - a.profit);
    Rigs.toRent.sort((a, b) => b.profit - a.profit);

    const balanceBTC = await Http.getBtcBalance();

    Rigs.balance.btc = balanceBTC.confirmed;
    Rigs.balance.pendingBtc = balanceBTC.unconfirmed;
    Rigs.balance.usd = decimal(Rigs.balance.btc * getCryptoPrice('btc'));
    Rigs.balance.pendingUsd = decimal(Rigs.balance.pendingBtc * getCryptoPrice('btc'));

    const pending = ` | pending: $${ Rigs.balance.pendingUsd } (${ Rigs.balance.pendingBtc } btc)`;
    const notRented = getNotRentedRigs();

    if(Utils.getTickCount() - Rigs.infoTick >= 60000)
    {
        updateCurrencies();
        Rigs.infoTick = Utils.getTickCount();

        Utils.log(`${ rigs.length } rigs fetched succesfully | out of balance: ${ notRented.outOfBalance } | profit but rented: ${ notRented.profitButRented } | no profit: ${ notRented.noProfit } | rented: ${ Rigs.rented.length } | balance: $${ Rigs.balance.usd } (${ Rigs.balance.btc } btc)${ Rigs.balance.pendingUsd > 0 ? pending : '' } .. ${ Utils.getTickCount() - t } ms`, 'fetch');
    }
}

async function updateCurrencies()
{
    Rigs.currenciesPrice.btc = await Http.getBtcPrice();
    Rigs.currenciesPrice.eth = await Http.getEthPrice();
    Rigs.usdPerMHs = await Http.getDailyReward(getCryptoPrice('eth'));
    Rigs.dailyReward = Rigs.usdPerMHs * 100;
}

export async function checkRigsProfit()
{
    await updateRigs();

    for(let i = 0; i < Rigs.toRent.length; i++)
    {
        const rig = Rigs.toRent[i];

        /* Check if it's online or rented, and verify that current total profit is above totalMinProfit */
        if((rig.isOnline || rig.isRented) && rig.status != 'disabled' && Rigs.totalProfit >= RentSettings.totalMinProfit && RentSettings.maxHours >= rig.rentHours)
        {
            /* Check if it's profitable */
            if(decimal(rig.profit) >= RentSettings.minProfit)
            {
                /* Check if we have enough balance */
                if(getMyBalance().btc >= rig.costBTC)
                {
                    /* Rent rig if available */
                    if(rig.status == 'available')
                    {
                        Rent.rentRig(rig);
                        Utils.log(`Trying to rent data = ${ JSON.stringify(rig.rawData) }`, '', false);
                    }
                }
            }
        }
    }
}

function showRentedRigs()
{
    var totalProfit = 0, totalMHs = 0;

    Utils.log(chalk.black.bgGreen(` > Current rentals: ${ Rigs.rented.length } rig(s) < `));

    for(let i = 0; i < Rigs.rented.length; i++)
    {
        const rig = Rigs.rented[i];

        var rowtext = '';
        var status = '';

        status = chalk.greenBright('rented');

        if(rig.status == 'rented')
        {
            if(rig.hoursLeft < 2)
                rowtext = chalk.red(decimal(rig.hoursLeft) + ' hours left.');
            else if(rig.hoursLeft < 4)
                rowtext = chalk.yellow(decimal(rig.hoursLeft) + ' hours left.');
            else
                rowtext = chalk.green(decimal(rig.hoursLeft) + ' hours left.');
        }
        else if(rig.status == 'disabled')
            rowtext = chalk.bgRed(' '.repeat(5) + 'disabled' + ' '.repeat(5));
        else if(rig.status == 'offline')
            rowtext = chalk.bgRed(' '.repeat(5) + 'shutdown' + ' '.repeat(5));

        showRigStr(rig.url, rig.hashrate, rig.rentHours, rig.costUSD, rig.costBTC, rig.reward, rig.profit, null, rowtext, status);

        totalProfit += rig.profit;
        totalMHs += rig.hashrate;
    }

    const balance = getMyBalance();
    Rigs.totalProfit = totalProfit;

    Utils.log(chalk.bgWhiteBright.black(` Total hashrate: ${ decimal(totalMHs) } MH/s | Total profit: $${ decimal(totalProfit) } | [minHours = ${ RentSettings.minHours } maxHours = ${ RentSettings.maxHours } minProfit = ${ RentSettings.minProfit } totalMinProfit = ${ RentSettings.totalMinProfit }] `)); 
    Utils.log(chalk.bgBlue.white(` BTC: $${ getCryptoPrice('btc') } | ETH: $${ getCryptoPrice('eth') } | Reward 100 MH/s: $${ decimal(Rigs.dailyReward) } ($${ decimal(Rigs.usdPerMHs, 3) }) | Balance: $${ decimal(balance.usd) } (${ balance.btc } btc) `));
}

function showToRentRigs(onlyAvailable)
{
    Utils.log(chalk.black.bgGreen(` > Available rigs for rent: ${ Rigs.toRent.length } rig(s) < `));

    for(let i = 0; i < Rigs.toRent.length; i++)
    {
        const rig = Rigs.toRent[i];

        var rowtext = '';
        var status = '';

        if(rig.status == 'available')
        {
            rowtext = chalk.bgGreen(' '.repeat(5) + 'for rent' + ' '.repeat(5));

            if(rig.profit >= RentSettings.minProfit)
                if(rig.costBTC > getMyBalance().btc)
                    status = chalk.bold('no funds');
        }
        else if(rig.status == 'rented')
        {
            rowtext = decimal(rig.hoursLeft) + ' hours left.';
            status = isMyRent(rig.id) ? chalk.greenBright('rented') : chalk.red('rented');
        }
        else if(rig.status == 'disabled')
            rowtext = chalk.bgRed(' '.repeat(5) + 'disabled' + ' '.repeat(5));
        else if(rig.status == 'offline')
            rowtext = chalk.bgRed(' '.repeat(5) + 'shutdown' + ' '.repeat(5));

        if(onlyAvailable)
        {
            if(rig.status == 'available')
                showRigStr(rig.url, rig.hashrate, rig.rentHours, rig.costUSD, rig.costBTC, rig.reward, rig.profit, rig.optimalDiff, rowtext, status);
        }
        else
            showRigStr(rig.url, rig.hashrate, rig.rentHours, rig.costUSD, rig.costBTC, rig.reward, rig.profit, rig.optimalDiff, rowtext, status);
    }
}

function showRigStr(url, hashrate, renthours, costusd, costbtc, reward, profit, mindiff, strrow1, status)
{
    var profitStr;

    hashrate = decimal(hashrate);
    costusd = costusd >= 1000 ? decimal(costusd, 0) : decimal(costusd);
    reward = decimal(reward);
    profit = profit <= -1000 ? decimal(profit, 0) : decimal(profit);
    strrow1 = strrow1.length == 0 ? ' '.repeat(18) : strrow1;

    if(profit >= 0)
        profitStr = chalk.green(`$${ profit }`);
    else if(profit < 0 && profit >= RentSettings.minProfit)
        profitStr = chalk.yellow(`$${ profit }`);
    else
        profitStr = chalk.red(`$${ profit }`);

    const mindiffStr = mindiff ? `| min diff: ${ mindiff } ` + indent(mindiff, 7) : '';

    const str = chalk.bold(`${ url }`) + indent(`[${ url }]:`, 33) + ` hashrate: ${ hashrate }` + indent(hashrate, 8) + ` | cost ${ renthours }hs: ` + indent(renthours, 2) + `$${ costusd }` + indent(costusd, 7) + `(${ decimal(costbtc, 8) } btc) | Reward ${ renthours }hs:` + indent(renthours, 2) + ` $${ reward }` + indent(reward, 7) + `| Profit: ${ profitStr }` + indent(profit, 7) + `${ mindiffStr }| ${ strrow1 }` + indent(strrow1, 18) + ` | ${ status }`;
    Utils.log(str);
}

/* 
*
*
*   Other
*
*
*/

export function getMyBalance()
{
    return Rigs.balance;
}

function isMyRent(id)
{
    for(let i = 0; i < Rigs.rented.length; i++)
        if(Rigs.rented[i].id == id)
            return true;

    return false;
}

function getCryptoPrice(crypto)
{
    return crypto == 'eth' ? Rigs.currenciesPrice.eth : Rigs.currenciesPrice.btc;
}

function getNotRentedRigs()
{
    var stats = { outOfBalance: 0, noProfit: 0, profitButRented: 0 };

    for(let i = 0; i < Rigs.toRent.length; i++)
    {
        const rig = Rigs.toRent[i];
        const balance = getMyBalance();

        if(rig.status != 'disabled')
        {
            if(rig.costBTC > balance.btc && rig.profit >= RentSettings.minProfit && !rig.isRented)
                stats.outOfBalance++;

            if(rig.profit < RentSettings.minProfit)
                stats.noProfit++;

            if(rig.profit >= RentSettings.minProfit && !isMyRent(rig.id))
                stats.profitButRented++;
        }
    }

    return stats;
}

process.stdin.on('keypress', (str, key) => 
{
    if(key)
    {
        if(key.name === 's')
        {
            for(let i = 0; i < 25; i++)
                console.log('');
            
            if(Rigs.toRent.length == 0)
                return Utils.log(` Please wait, still loading.. `, 'warning');

            showToRentRigs();
            console.log('');
            showRentedRigs();
        }
        else if(key.name === 'r')
        {
            if(Rigs.toRent.length == 0)
                return Utils.log(` Please wait, still loading.. `, 'warning');

            showToRentRigs(true);
        }
    }
});