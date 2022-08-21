import { createRequire } from "module"
const require = createRequire(import.meta.url)
const cron = require("node-cron")
import axios from "axios"
import fs from "fs"
import DbGen from "./pg.mjs"
import uploader from "./uploader.mjs"
import "dotenv/config"
import downloader from "./downloader.mjs"
import logger from "./logger.mjs"

const DbClient = DbGen()
// connecting to pg sever
DbClient.connect()
DbClient.on("connect", () =>
    console.log("connection with DB established through port 5432")
)

const IpfsUpload = async (tuples) => {
    const rows = []
    for (const iter of tuples.rows) {
        let row = iter.row.substr(1, iter.row.length - 2)
        row = row.split(",") // converting string row data to array where each attribute's value is stored at a distinct index
        rows.push({
            url: row[0],
            cb: row[1],
            status: row[2],
            filename: row[3],
            guid: row[4],
            retries: row[5],
            id: row[6],
        })
    }
    for (const row of rows) {
        if (row.retries > 0) {
            //* attempting to upload file to ipfs
            if (row.status === "pending") {
                let downloaded = await downloader(
                    //* downloading file from s3
                    row.id,
                    row.guid,
                    row.url,
                    row.retries
                )
                if (downloaded) {
                    // true if downlaod was sucessful
                    let uploaded = await uploader(
                        //* uplaoding to ipfs
                        row.guid,
                        row.filename,
                        row.cb,
                        row.id,
                        row.retries
                    )
                    if (uploaded) {
                        // true if upload was sucessful
                        //* deleting file form local storage once it's uploaded to ipfs
                        fs.unlink(`./pdfs/${row.guid}.pdf`, (err) => {
                            console.log("deleting...")
                            err ? logger.error(err) : console.log("deleted!")
                        })
                    }
                }
            } else {
                let uploaded = await uploader(
                    //* uplaoding to ipfs
                    row.guid,
                    row.filename,
                    row.cb,
                    row.id,
                    row.retries
                )
                if (uploaded) {
                    // true if upload was sucessful
                    //* deleting file form local storage once it's uploaded to ipfs
                    fs.unlink(`./pdfs/${row.guid}.pdf`, (err) => {
                        console.log("deleting...")
                        err ? logger.error(err) : console.log("deleted!")
                    })
                }
            }
        } else {
            try {
                //* posting feedback to callback api to inform about failure to upload the file to ipfs
                axios.post(row.cb, {
                    status: "failed",
                    url: null,
                    error: "request limit reached!",
                })
            } catch (error) {
                logger.error(error)
                throw error
            } finally {
                fs.unlink(`./pdfs/${row.guid}.pdf`, (err) => {
                    console.log("deleting...")
                    err ? logger.error(err) : console.log("deleted!")
                })
            }
        }
    }
}

const CronJob = () => {
    cron.schedule("* * * * *", () => {
        // "* * * * *" arguement passed makes the cron job run after a minute's interval
        //* getting data for files whose upload is still pending
        DbClient.query(
            `SELECT (file_url,callback,status,filename,guid,retries,id) FROM jobs
                WHERE status=$1 OR status=$2`,
            ["pending", "pending upload"],
            (err, result) => {
                if (err) {
                    logger.error(err)
                    console.log(err)
                } else {
                    console.log(result.rows)
                    IpfsUpload(result)
                }
            }
        )
    })
}

CronJob()

export default CronJob
