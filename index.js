const cheerio = require("cheerio")
const axios = require("axios")
const fs = require('fs')
const archiver = require('archiver')

// Scrape crossword data from xwordinfo for the date provided in M(M)/D(D)/YYYY format 
async function performScraping(date, archive) {
    // downloading the target web page
    // by performing an HTTP GET request in Axios
    let axiosResponse;
    try {
        axiosResponse = await axios.request({
            method: "GET",
            url: `https://www.xwordinfo.com/Crossword?date=${date}`,
        });
    } catch (e) {
        console.log('request had not ok status');
        return;
    }


    // console.log('response: ',axiosResponse)
    const $ = cheerio.load(axiosResponse.data)
    const table = $('#PuzTable').find('tbody')

    const numbers = []
    $(table).children('tr').each((i, row) => {
        let numberRow = []
        $(row).children('td').each((i, cell) => {
            if ($(cell).find('.num').text() != '') {
                numberRow.push($(cell).find('.num').text())
            }
            // console.log('has black square: ',$(cell).hasClass("black"))
            else if ($(cell).hasClass("black")) {
                numberRow.push('-')
            } else {
                numberRow.push('')
            }
        });
        numbers.push(numberRow)
    });

    const clues = {}
    const answers = {}
    const aClues = $('#ACluesPan').find(".numclue")
    let current = $(aClues).find('div');
    let currentAns = $(aClues).find('div a')

    while ($(current).next().text()) {
        clues[`${$(current).html()}a`] = $(current).next().html().split(" : <")[0];
        // console.log('current answer: ', $(currentAns).html())
        answers[`${$(current).html()}a`] = $(currentAns).html();
        current = $(current).next().next();
        currentAns = $(current).find('div a');
    }

    const dClues = $('#DCluesPan').find(".numclue")
    current = $(dClues).find('div');
    currentAns = $(dClues).find('div a')

    while ($(current).next().text()) {
        // console.log('clue: ', $(current).html())
        clues[`${$(current).html()}d`] = $(current).next().html().split(" : <")[0];
        answers[`${$(current).html()}d`] = $(currentAns).html();
        current = $(current).next().next();
        currentAns = $(current).find('div a');
    }

    // console.log(clues)
    // console.log(answers)
    if (Object.keys(clues).length != 0) {
        splitDate = date.split('/')
        fd = fs.openSync(__dirname + `/data/${splitDate[2]}/${splitDate.join('-')}.json`, 'a')
        fs.writeSync(fd, JSON.stringify({
            numbers,
            clues,
            answers
        }))
        fs.close(fd);
        // archive.append(JSON.stringify({
        //     numbers,
        //     clues,
        //     answers
        // }), { name: `${splitDate.join('-')}.json`, prefix: `${splitDate[3]}`})
    }
    // fs.writeFile(__dirname + `/data/${y}/${date.split('/').join('-')}.json`, JSON.stringify({
    //     numbers,
    //     clues,
    //     answers
    // }), {flag: "w+"}, function (err) {
    //     console.log("error: ", err);
    // })
}

const monthDays = {
    1: (y) => 31,
    2: y => y % 4 == 0 ? 29 : 28,
    3: y => 31,
    4: y=>30,
    5: y=>31,
    6: y=>30,
    7: y=>31,
    8: y=>31,
    9: y=>30,
    10: y=>31,
    11: y=>30,
    12: y=>31
}

async function runJob() {
    const output = fs.createWriteStream(__dirname + '/data.zip');
    const archive = archiver('zip', {
    zlib: { level: 9 } // Sets the compression level.
    });
    archive.pipe(output)

    // first puzzle available: 11/21/1993
    for (var y = 2007; y <= 2014; y++) {
        fs.mkdirSync(__dirname + `/data/${y}`)
        for (var m = 1; m <= 12; m++) {
            for (var d = 1; d <= monthDays[m](y); d++) {
                await performScraping(`${m}/${d}/${y}`, archive)
            }
        }
        console.log('finished ', y)
    }

    archive.directory(__dirname + `/data`, 'data')
    archive.finalize()
}

runJob();

