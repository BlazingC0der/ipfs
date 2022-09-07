import { createRequire } from "module"
const require = createRequire(import.meta.url)
const cron = require("node-cron")
import fs from "fs"
import DbGen from "./utils/pg.mjs"
import UploadPdf from "./uploaders/resume-uploader.mjs"
import "dotenv/config"
import downloader from "./writers/downloader.mjs"
import logger from "./loggers/logger.mjs"
import MetaDataWriter from "./writers/meta-gen.mjs"
import MintNft from "./utils/minter.mjs"
import UploadJson from "./uploaders/meta-uploader.mjs"

const DbClient = DbGen()
// connecting to pg sever
DbClient.connect()
DbClient.on("connect", () =>
    console.log("connection with DB established through port 5432")
)

const del = (filename, folder, extension) => {
    fs.unlink(`./${folder}/${filename}.${extension}`, (err) => {
        console.log(`deleting ${extension}...`)
        err ? logger.error(err) : console.log("deleted!")
    })
}

const update = (id) => {
    DbClient.query(
        `UPDATE jobs
    SET status=$1
    WHERE id=$2`,
        ["completed", id],
        (err, res) => {
            err ? console.log(err) : console.log(res)
        }
    )
}

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
            MetaUrl: row[7],
            uid: row[8],
            fid: row[7].substr(row[7].lastIndexOf("=") + 1)
        })
    }
    for (const row of rows) {
        //* attempting to upload file to ipfs
        if (row.status === "pending") {
            let downloaded = await downloader(
                //* downloading file from s3
                row.id,
                row.guid,
                row.url,
                row.retries,
                row.cb
            )
            if (downloaded) {
                // true if downlaod was sucessful
                let cid = await UploadPdf(
                    //* uplaoding to ipfs
                    false,
                    row.guid,
                    row.filename,
                    row.cb,
                    row.id,
                    row.retries
                )
                if (cid) {
                    // true if upload was sucessful
                    const IpfsLink = `https://dweb.link/ipfs/${cid}`
                    del(row.guid, "pdfs", "pdf") //* deleting file form local storage once it's uploaded to ipfs
                    let meta = await MetaDataWriter(
                        false,
                        row.guid,
                        row.uid,
                        IpfsLink
                    )
                    if (meta) {
                        let MetaLink = await UploadJson(row.guid, row.id)
                        console.log("meta link:", MetaLink)
                        if (MetaLink) {
                            del(row.guid, "metadata", "json")
                            await MintNft(MetaLink)
                            update(row.id)
                        }
                    }
                }
            }
        } else if (row.status === `"pending update"`) {
            let downloaded = await downloader(
                //* downloading file from s3
                row.id,
                row.guid,
                row.url,
                row.retries,
                row.cb
            )
            if (downloaded) {
                // true if downlaod was sucessful
                let cid = await UploadPdf(
                    //* uplaoding to ipfs
                    true,
                    row.guid,
                    row.filename,
                    row.cb,
                    row.id,
                    row.retries
                )
                if (cid) {
                    // true if upload was sucessful
                    const IpfsLink = `https://dweb.link/ipfs/${cid}`
                    del(row.guid, "pdfs", "pdf") //* deleting file form local storage once it's uploaded to ipfs
                    let meta = await MetaDataWriter(
                        true,
                        row.guid,
                        row.uid,
                        IpfsLink,
                        row.MetaUrl
                    )
                    if (meta) {
                        let MetaLink = await UploadJson(
                            row.guid,
                            row.id,
                            row.fid
                        )
                        if (MetaLink) {
                            update(row.id)
                            del(row.guid, "metadata", "json")
                        }
                    }
                }
            }
        } else if (row.status === "pending file upload") {
            let cid = await UploadPdf(
                //* uplaoding to ipfs
                true,
                row.guid,
                row.filename,
                row.cb,
                row.id,
                row.retries
            )
            if (cid) {
                // true if upload was sucessful
                const IpfsLink = `https://dweb.link/ipfs/${cid}`
                del(row.guid, "pdfs", "pdf") //* deleting file form local storage once it's uploaded to ipfs
                let meta = await MetaDataWriter(
                    true,
                    row.guid,
                    row.uid,
                    IpfsLink,
                    row.MetaUrl
                )
                if (meta) {
                    let MetaLink = await UploadJson(row.guid, row.id, row.fid)
                    if (MetaLink) {
                        update(row.id)
                        del(row.guid, "metadata", "json")
                    }
                }
            }
        } else if (row.status === "pending meta download") {
            let meta = await MetaDataWriter(
                true,
                row.guid,
                row.uid,
                IpfsLink,
                row.MetaUrl
            )
            if (meta) {
                let MetaLink = await UploadJson(row.guid, row.id, row.fid)
                if (MetaLink) {
                    update(row.id)
                    del(row.guid, "metadata", "json")
                }
            }
        } else if (row.status === "pending meta upload") {
            let MetaLink = await UploadJson(row.guid, row.id, row.fid)
            if (MetaLink) {
                update(row.id)
                del(row.guid, "metadata", "json")
            }
        } else if (row.status === "pending file upload and mint") {
            let cid = await UploadPdf(
                //* uplaoding to ipfs
                true,
                row.guid,
                row.filename,
                row.cb,
                row.id,
                row.retries
            )
            if (cid) {
                // true if upload was sucessful
                const IpfsLink = `https://dweb.link/ipfs/${cid}`
                del(row.guid, "pdfs", "pdf") //* deleting file form local storage once it's uploaded to ipfs
                let meta = await MetaDataWriter(
                    false,
                    row.guid,
                    row.uid,
                    IpfsLink
                )
                if (meta) {
                    let MetaLink = await UploadJson(row.guid, row.id)
                    if (MetaLink) {
                        del(row.guid, "metadata", "json")
                        await MintNft(MetaLink)
                        update(row.id)
                    }
                }
            }
        } else if (row.status === "pending meta upload and mint") {
            let MetaLink = await UploadJson(row.guid, row.id)
            if (meta) {
                if (MetaLink) {
                    del(row.guid, "metadata", "json")
                    await MintNft(MetaLink)
                    update(row.id)
                }
            }
        }
    }
}

const CronJob = () => {
    cron.schedule("* * * * *", () => {
        // "* * * * *" arguement passed makes the cron job run after a minute's interval
        //* getting data for files whose upload is still pending
        DbClient.query(
            `SELECT (file_url,callback,status,filename,guid,retries,id,meta_url,user_id) FROM jobs
                WHERE status=$1 OR status=$2 OR status=$3 OR status=$4 OR status=$5 OR status=$6 OR status=$7`,
            [
                "pending",
                "pending file upload",
                "pending meta upload and mint",
                "pending file upload and mint",
                "pending meta upload",
                "pending meta download",
                "pending update"
            ],
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

export default CronJob
