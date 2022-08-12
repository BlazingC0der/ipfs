import axios from 'axios'
import fs from 'fs'
import DbGen from './pg.mjs'

const DbClient = DbGen()

DbClient.connect()
DbClient.on("connect", () => console.log("connection with DB established through port 5432"))

const update = (url, err) => {
    DbClient.query(`UPDATE jobs
                    SET error=$1,
                    WHERE file_url=$3 RETURNING*`, [err, url], (err, result) => {
        if (err) {
            console.log(err)
        } else {
            console.log(result.rows)
        }
    })
}

const downloader = async (url, guid) => {
    let downloaded = true
    let res = await axios.get(url, { responseType: "arraybuffer" })
    console.log(res)
    // res.data.pipe(fs.createWriteStream(`./pdfs/${guid}.pdf`))
    fs.writeFile(`./pdfs/${guid}.pdf`, res.data, (err) => {
        if (err) {
            console.log(err)
            update(url, err)
            downloaded = false
        }
    })
    return downloaded
}

export default downloader