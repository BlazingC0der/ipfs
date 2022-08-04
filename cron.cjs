const cron = require('node-cron')
const express = require('express')
const web3 = require('web3.storage')
const Web3Storage = web3.Web3Storage
const getFilesFromPath = web3.getFilesFromPath
const pg = require('pg')
const axios = require('axios')
const fs = require('fs')

const DbClient = new pg.Client({
    host: "localhost",
    port: 5432,
    user: "postgres",
    password: "admin",
    database: "resume_inc"
})

DbClient.connect()
DbClient.on("connect", () => console.log("connection with DB established through port 5432"))

const update = (status, CbUrl, url, cid = null) => {
    console.log("updating...")
    DbClient.query(`UPDATE jobs
                    SET status=$1
                    WHERE file_url=$2 RETURNING*`, [status, url], (err, result) => {
        if (err) {
            console.log(err)
        } else {
            console.log(result.rows)
            axios.post(CbUrl, { status, url: `https://dweb.link/ipfs/${cid}` })
        }
    })
}

cron.schedule('* * * * *', async () => {
    const result = await DbClient.query(`SELECT (file_url,callback,status) FROM jobs
                WHERE NOT status = $1`, ["uploaded"])
    const rows = []
    for (const iter of result.rows) {
        let row = iter.row.substr(1, iter.row.length - 2)
        row = row.split(",")
        rows.push({ url: row[0], cb: row[1], status: row[2] })
    }
    for (const row of rows) {
        await axios.post(row.cb, { status: row.status }).then(async (res) => {
            if (res.data === "reupload") {
                await axios.get(row.url, { responseType: "blob" }).then(async (result) => {
                    const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkaWQ6ZXRocjoweGVERTMyMGU4MDZEQ2UwNDdjOEE2M2E4MDIxNDY5NjZkNjY3RGRGQkYiLCJpc3MiOiJ3ZWIzLXN0b3JhZ2UiLCJpYXQiOjE2NTc3Nzg2ODYwMTgsIm5hbWUiOiJ0a24ifQ.zu6yLSdUpauM3Am_6LDY2o0RpoJTVuhKcJdgPvaX2QM"
                    const Web3Client = new Web3Storage({ token })
                    fs.writeFile('./pdfs/temp.pdf', result.data, (err) => {
                        if (err) throw err
                    })
                    const file = await getFilesFromPath('./pdfs/temp.pdf')
                    const cid = await Web3Client.put(file, { name: row.url.substr(row.url.lastIndexOf("/") + 1) }).catch(async (err) => {
                        update(err, row.cb, row.url)
                        return
                    })
                    update("uploaded", row.cb, row.url, cid)
                })
            }
        })
    }
})
