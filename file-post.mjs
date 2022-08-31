import express from "express"
import { v4 } from "uuid"
import "dotenv/config"
import DbGen from "./pg.mjs"
import formidable from "formidable"

const app = express()
const DbClient = DbGen()
// connecting to pg sever
DbClient.connect()
DbClient.on("connect", () =>
    console.log("connection with DB established through port 5432")
)

app.listen(3000, () => console.log(`App available on http://localhost:3000`))

const insert = (filename, guid, status, CbUrl, url, retries) => {
    DbClient.query(
        `INSERT INTO jobs (filename,guid,file_url,status,callback,retries)
                VALUES($1,$2,$3,$4,$5,$6) RETURNING*`,
        [filename, guid, url, status, CbUrl, retries],
        (err, result) => {
            err ? console.log(err) : console.log(result.rows)
        }
    )
}

app.post("/send-file-link", (req, res) => {
    const auth = req.headers.authorization
    const key = auth.split(" ")[1] // extracting key form auth header
    const callback = req.headers.callback
    if (key === null) {
        res.sendStatus(401) // forbidden
    } else {
        if (key !== process.env.ApiKey) {
            res.sendStatus(403) // unauthorized
        } else {
            let formData = new formidable.IncomingForm() // getting form data
            formData.parse(req, (err, fields) => {
                //* inserting file data into db - name, guid, status, callback url, retries
                insert(
                    fields.filename,
                    v4(),
                    "pending",
                    callback,
                    fields.url,
                    3
                )
            })
            res.sendStatus(200) // OK
        }
    }
})
