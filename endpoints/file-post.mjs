import express from "express"
import { v4 } from "uuid"
import "dotenv/config"
import DbGen from "../utils/pg.mjs"
import formidable from "formidable"

const app = express()
const DbClient = DbGen()
// connecting to pg sever
DbClient.connect()
DbClient.on("connect", () =>
    console.log("connection with DB established through port 5432")
)

app.listen(3000, () => console.log(`App available on http://localhost:3000`))

const insert = (filename, guid, status, CbUrl, url, retries, uid) => {
    DbClient.query(
        `INSERT INTO jobs (filename,guid,file_url,status,callback,retries,user_id)
                VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING*`,
        [filename, guid, url, status, CbUrl, retries, uid],
        (err, result) => {
            err ? console.log(err) : console.log(result.rows)
        }
    )
}

const update = (uid, filename, url, status, retries) => {
    DbClient.query(
        `UPDATE jobs
                    SET filename=$1, file_url=$2, status=$3, retries=$4
                    WHERE user_id=$5 RETURNING*`,
        [filename, url, status, retries, uid],
        (err, result) => {
            if (err) {
                console.log(err)
            } else {
                console.log(result.rows)
            }
        }
    )
}

const CheckUser = async (uid) => {
    let exists = false
    const res = await DbClient.query(
        `SELECT id FROM jobs
    WHERE user_id=$1`,
        [uid]
    )
    if (res.rows.length > 0) {
        exists = true
    }
    return exists
}

const PostFileLink = async () => {
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
                formData.parse(req, async (err, fields) => {
                    //* inserting file data into db - name, guid, status, callback url, retries, user id
                    if (await CheckUser(fields.userId)) {
                        // if user already exists, update DB with new file url
                        update(
                            fields.userId,
                            fields.filename,
                            fields.url,
                            `pending update`,
                            3
                        )
                    } else {
                        // in case of new user, insert a new record
                        insert(
                            fields.filename,
                            v4(),
                            "pending",
                            callback,
                            fields.url,
                            3,
                            fields.userId
                        )
                    }
                })
                res.sendStatus(200) // OK
            }
        }
    })
}

export default PostFileLink
