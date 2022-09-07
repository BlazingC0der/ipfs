import pg from "pg"
import "dotenv/config"

const DbGen = () => {
    // creating new pg client instance
    const DbClient = new pg.Client({
        host: process.env.host,
        port: process.env.port,
        user: process.env.user,
        password: process.env.password,
        database: process.env.database,
    })
    return DbClient
}

export default DbGen
