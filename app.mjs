import express from 'express'
import pg from 'pg'
import axios from 'axios'
import fs from 'fs'
import { v4 } from 'uuid'
import 'dotenv/config'
import formidable from 'formidable'

const app = express()
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

const insert = (filename, guid, status, CbUrl, url, error = null) => {
    if (error) {
        DbClient.query(`INSERT INTO jobs (filename,guid,file_url,status,callback,error)
                VALUES($1,$2,$3,$4,$5,$6) RETURNING*`, [filename, guid, url, status, CbUrl, error], (err, result) => { err ? console.log(err) : console.log(result.rows) })
    } else {
        DbClient.query(`INSERT INTO jobs (filename,guid,file_url,status,callback)
                VALUES($1,$2,$3,$4,$5) RETURNING*`, [filename, guid, url, status, CbUrl], (err, result) => { err ? console.log(err) : console.log(result.rows) })
    }
}

app.post("/upload", (req, res) => {
    const auth = req.headers.authorization
    const key = auth.split(" ")[1]
    const callback = req.headers.callback
    if (key === null) {
        res.sendStatus(401)
    } else {
        if (key !== process.env.ApiKey) {
            res.sendStatus(403)
        } else {
            let formData = new formidable.IncomingForm()
            formData.parse(req, async (err, fields) => { 
                axios.get(fields.url, { responseType: "blob" }).then(async (result) => {
                    const guid = v4()
                    fs.writeFile(`./pdfs/${guid}.pdf`, result.data, (err) => {
                        if (err) {
                            insert(fields.filename, guid, "file corrupted", callback, fields.url, err)
                            console.log(err)
                            res.send(err)
                        }
                    })
                    insert(fields.filename, guid, "pending", callback, fields.url)
                    res.send("file successfully downloaded from s3")
                }).catch((err) => {
                    console.log(err)
                    insert(fields.filename, guid, "file not found", callback, fields.url, err)
                    res.send(err)
                })
             })
        }
    }
})