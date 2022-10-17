import * as Utils from './Utils.js';
import * as Http from './Http.js';
import * as Core from './Core.js';

const decimal = Utils.decimal;
const indent = Utils.indent;

const rigUrl = 'http://rig.rent/rigs/';

var RentQueue = [];

setInterval(tryToRent, 100);

export function rentRig(rig)
{
	return;
	
    if(isInQueue(rig.id)) return;

    RentQueue.push(rig);

    const url = `[${ rigUrl }${ rig.id }]:`;
    const hashrate = decimal(rig.hashrate);
    const profit = decimal(rig.profit);
    const costusd = decimal(rig.costUSD);
    const costbtc = decimal(rig.costBTC, 8);
    const length = rig.rentHours;
    const balance = Core.getMyBalance(); 

    Utils.log(`${ url }` + indent(url, 30) + ` added to queue | length: ${ length } hs | hashrate: ${ hashrate }` + indent(hashrate, 8) + `| profit: $${ profit } ` + indent(profit, 5) + `| cost: $${ costusd }` + indent(costusd, 6) + `(${ costbtc } btc) | current balance: $${ decimal(balance.usd) } (${ balance.btc } btc)`, 'warning');
}

function isInQueue(id)
{
    for(let i = 0; i < RentQueue.length; i++)
        if(RentQueue[i].id == id)
            return true;
    return false;
}

async function tryToRent()
{
    for(let i = 0; i < RentQueue.length; i++)
    {
        const rig = RentQueue[i];

        if(!rig.renting)
        {
            rig.renting = true;

            const result = await Http.rentRig(rig.id, rig.rentHours);
            const url = `[${ rigUrl }${ rig.id }]:`;
            const hashrate = decimal(rig.hashrate);
            const profit = decimal(rig.profit);
            const costusd = decimal(rig.costUSD);
            const costbtc = decimal(rig.costBTC, 8);
            const length = rig.rentHours;
            const balance = Core.getMyBalance(); 

            if(result)
                Utils.log(`${ url }` + indent(url, 30) + ` succesfully rented! | length: ${ length } hs | hashrate: ${ hashrate }` + indent(hashrate, 8) + `| profit: $${ profit } ` + indent(profit, 5) + `| cost: $${ costusd }` + indent(costusd, 6) + `(${ costbtc } btc) | new balance: $${ decimal(balance.usd - costusd) } (${ decimal(balance.btc - costbtc, 8) } btc)`, 'success');
            else
                Utils.log(`Could not rent rig ${ rig.id }, removing from queue..`, 'error');
            
            removeFromQueue(rig.id);
            //setTimeout(() => Core.checkRigsProfit(), 1000)
        }
    }
}

function removeFromQueue(id)
{
    var arr = [];

    for(let i = 0; i < RentQueue.length; i++)
    {
        if(RentQueue[i].id != id)
            arr.push(RentQueue[i]);
    }

    RentQueue = arr;
}