import { Web3Storage } from "web3.storage"
import "dotenv/config"
import DbGen from "../utils/pg.mjs"
import axios from "axios"
import GetFile from "../utils/FileGetter.mjs"
import logger from "../loggers/logger.mjs"
import "dotenv/config"

const DbClient = DbGen()
// connecting to pg sever
DbClient.connect()

// @param params error msg and updated no. of retries in case upload fails otherwise id,status, callback url, name of the url attribtue which is to be updated and cid for uploaded file is passed
const update = (existing, id, ...params) => {
    if (params.length === 4) {
        let err = params[0]
        let retries = params[1]
        let cb = params[2]
        let guid = params[3]
        let status = ""
        if (existing) {
            status = retries === 0 ? "failed" : "pending file upload"
        } else {
            status = retries === 0 ? "failed" : "pending file upload and mint"
        }
        //* updating error msg and decremnting no. of retries in the DB
        DbClient.query(
            `UPDATE jobs
                    SET retries=$1, error=$2, status=$3
                    WHERE id=$4 RETURNING*`,
            [retries, err, status, id],
            (err, result) => {
                if (err) {
                    logger.error(err)
                    console.log(err)
                } else {
                    if (status === "failed") {
                        try {
                            //* posting feedback to callback api to inform about failure to upload the file to ipfs
                            axios.post(cb, {
                                status,
                                url: null,
                                error: "reached request limit!"
                            })
                        } catch (error) {
                            logger.error(error)
                            throw error
                        } finally {
                            fs.unlink(
                                `${process.env.FilePath}${guid}.pdf`,
                                (err) => {
                                    console.log("deleting...")
                                    err
                                        ? logger.error(err)
                                        : console.log("deleted!")
                                }
                            )
                        }
                    }
                    console.log(result.rows)
                }
            }
        )
    } else {
        let cid = params[0]
        const IpfsLink = `https://dweb.link/ipfs/${cid}` // url to access file uploaded to ipfs
        //* updating status to uploaded and enetring ipfs url into DB
        DbClient.query(
            `UPDATE jobs
                    SET ipfs_url=$1
                    WHERE id=$2 RETURNING*`,
            [IpfsLink, id],
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

const UploadPdf = async (existing, guid, name, cb, id, retries) => {
    console.log("uploading resume....")
    const file = await GetFile(`${process.env.FilePath}${guid}.pdf`)
    const Web3Client = new Web3Storage({ token: process.env.Web3Token }) // creating a web.storage client instance
    try {
        //* uploading to ipfs using web3.storage pinnning service
        const cid = await Web3Client.put(file, { name: name })
        //* updating status upon succesful upload to ipfs
        update(existing, id, cid)
        return cid
    } catch (err) {
        logger.error(err)
        console.log(err)
        //* deceremnting retries upon failed attempt to upload file to ipfs
        update(existing, id, err, retries - 1, cb, guid)
        return null
    }
}

export default UploadPdf
