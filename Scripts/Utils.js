import crypto from 'crypto';
import chalk from 'chalk';
import fs from 'fs';

const ESC_REGEX = /(\x1b.)((([0-9][0-9][0-9])|([0-9][0-9])|([0-9]))m)/g;
var lastLogType = '';

/*
*
*   UTILS
*
*/

export function getTickCount() 
{
    return new Date().getTime();
}

export function getNonce()
{
    return new Date().getTime().toString().substring(5) + 16592809957906;
}

export function signHMAC(key, secret)
{
    return crypto.createHmac('sha1', secret).update(key).digest('hex')
}

export function decimal(value, decimal)
{
    if(decimal == 0) return Math.floor(value);
    decimal = decimal ? decimal : 2;
    return Number(Math.round(parseFloat(value + 'e' + decimal)) + 'e-' + decimal).toFixed(decimal);
}

export function indent(str, max)
{
    str = str.toString();
    str = str.replace(ESC_REGEX, '');
    var count = max - str.length;
    count = count < 0 ? 0 : count;
    return ' '.repeat(count);
}

export function log(logStr, type, show)
{
    const d = new Date();
    const date = `[${ chalk.green(addZero(d.getDate())) }/${ chalk.green(addZero(d.getMonth() + 1)) }/${ chalk.green(d.getFullYear()) } - ${ chalk.green(addZero(d.getHours())) }:${ chalk.green(addZero(d.getMinutes())) }:${ chalk.green(addZero(d.getSeconds())) }]`
    var str = '';

    if(type == 'success')
        str = `${ date } ${ chalk.bgGreen.black(logStr) }`;
    else if(type == 'warning')
        str = `${ date } ${ chalk.bgYellow.black(logStr) }`;
    else if(type == 'error')
        str = `${ date } ${ chalk.bgRed(logStr) }`;
    else
        str = `${ date } ${ logStr }`;

    if(lastLogType != type)
        console.log('');

    lastLogType = type;

    if(show != false)
        console.log(str);

    fs.writeFile(`./Log/Core.log`, str.replace(ESC_REGEX, '') + '\n', { flag: 'a+' }, err => { });
}

function addZero(s) 
{
    return s.toString().length == 1 ? `0${ s }` : s;
}

/* Convert to G, T, P */
export function getDiff(d) 
{
    /* G */
    if(d <= 1000000000000 - 1)
        return roundDecimal(parseFloat(d) / 1000000000) + ' G';
    /* T */
    else if(d >= 1000000000000 && d < 1000000000000000 - 1)
        return roundDecimal(parseFloat(d) / 1000000000000) + ' T';
    /* P */
    else if(d >= 1000000000000000 - 1)
        return roundDecimal(parseFloat(d) / 1000000000000000) + ' P';
}

export function roundDecimal(d)
{
    return Number(Math.round(parseFloat(d + 'e' + 2)) + 'e-' + 2).toFixed(2);
}