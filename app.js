const express = require('express');
const web3 = require('web3.storage')
const Web3Storage = web3.Web3Storage
const getFilesFromPath = web3.getFilesFromPath
const pg = require('pg');
const axios = require('axios');
const fs = require('fs');
const formidable = require('formidable');
const randomstring = require('randomstring');

const app = express()
const keys = [] // array to store api keys
const DbClient = new pg.Client({
    host: "localhost",
    port: 5432,
    user: "postgres",
    password: "admin",
    database: "resume_inc"
})

DbClient.connect()
DbClient.on("connect", () => console.log("connection with DB established through port 5432"))

app.set("view engine", "ejs")
app.listen(3000, () => console.log(`App available on http://localhost:3000`))

const update = (status, CbUrl, url) => {
    DbClient.query(`INSERT INTO jobs (file_url,status,callback)
                VALUES($1,$2,$3) RETURNING*`, [url, status, CbUrl], (err, result) => { err ? console.log(err) : console.log(result.rows) })
}

app.get("/", (req, res) => {
    let ApiKey = randomstring.generate()
    keys.push(ApiKey)
    res.json({ api_key: ApiKey })
})
app.post("/upload", (req, res) => {
    const auth = req.headers.authorization
    const key = auth.split(" ")[1]
    const callback = req.headers.callback
    if (key === null) {
        res.sendStatus(401)
    } else {
        if (keys.find((ApiKey) => { return ApiKey === key }) === undefined) {
            res.sendStatus(403)
        } else {
            const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkaWQ6ZXRocjoweGVERTMyMGU4MDZEQ2UwNDdjOEE2M2E4MDIxNDY5NjZkNjY3RGRGQkYiLCJpc3MiOiJ3ZWIzLXN0b3JhZ2UiLCJpYXQiOjE2NTc3Nzg2ODYwMTgsIm5hbWUiOiJ0a24ifQ.zu6yLSdUpauM3Am_6LDY2o0RpoJTVuhKcJdgPvaX2QM"
            const Web3Client = new Web3Storage({ token })
            let formData = new formidable.IncomingForm()
            formData.parse(req, async (error, fields) => {
                console.log(fields)
                await axios.get(fields.url, { responseType: "blob" }).then(async (result) => {
                    fs.writeFile('./pdfs/temp.pdf', result.data, (err) => {
                        if (err) throw err
                    })
                    const file = await getFilesFromPath('./pdfs/temp.pdf')
                    const cid = await Web3Client.put(file, { name: fields.filename }).catch((err) => {
                        update(err, callback, fields.url)
                        res.send(err)
                    })
                    update("uploaded", callback, fields.url)
                    res.send(`https://dweb.link/ipfs/${cid}`)
                })
            })
        }
    }
})