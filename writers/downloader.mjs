import axios from "axios"
import fs from "fs"
import DbGen from "../utils/pg.mjs"
import logger from "../loggers/logger.mjs"
import "dotenv/config"

const DbClient = DbGen()
// connecting to pg sever
DbClient.connect()

const update = (id, err, retries, cb) => {
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
                    try {
                        //* posting feedback to callback api to inform about failure to upload the file to ipfs
                        axios.post(cb, {
                            status: "failed",
                            url: null,
                            error: "reached request limit!",
                        })
                    } catch (error) {
                        logger.error(error)
                        throw error
                    }
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

const downloader = async (id, guid, url, retries, cb) => {
    console.log("downloading resume...")
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
                update(id, err, retries - 1, cb)
                downloaded = false
                throw err
            }
        })
    } catch (err) {
        logger.error(err)
        //* decremting retries in DB for failure to download file from s3
        update(id, err, retries - 1, cb)
        throw err
    }
    return downloaded
}

export default downloader
