import axios from "axios"
import fs from "fs"
import DbGen from "./pg.mjs"
import logger from "./logger.mjs"
import "dotenv/config"

const DbClient = DbGen()
// connecting to pg sever
DbClient.connect()
DbClient.on("connect", () =>
    console.log("connection with DB established through port 5432")
)

const update = (id, err, retries) => {
    // updating error and decremnting retries
    if (retries === 0) {
        DbClient.query(
            `UPDATE jobs
                    SET error=$1, retries=$2, status=$3
                    WHERE id=$4 RETURNING*`,
            [err, retries, "failed", id],
            (err, result) => {
                if (err) {
                    logger.error(err)
                    console.log(err)
                } else {
                    console.log(result.rows)
                }
            }
        )
    } else {
        DbClient.query(
            `UPDATE jobs
                    SET error=$1, retries=$2
                    WHERE id=$3 RETURNING*`,
            [err, retries, id],
            (err, result) => {
                if (err) {
                    logger.error(err)
                    console.log(err)
                } else {
                    console.log(result.rows)
                }
            }
        )
    }
}

const downloader = async (id, guid, url, retries) => {
    console.log("downloading...")
    let downloaded = true
    try {
        //* downloading file from s3 as buffer
        let res = await axios.get(url, { responseType: "arraybuffer" })
        console.log(res)
        //* temporarily storing file locally
        fs.writeFile(`${process.env.FilePath}${guid}.pdf`, res.data, (err) => {
            if (err) {
                logger.error(err)
                console.log(err)
                //* decremting retries in DB for failure to write file to lcoal directory
                update(id, err, retries - 1)
                downloaded = false
                throw err
            }
        })
    } catch (err) {
        logger.error(err)
        //* decremting retries in DB for failure to download file from s3
        update(id, err, retries - 1)
        throw err
    }
    return downloaded
}

export default downloader
