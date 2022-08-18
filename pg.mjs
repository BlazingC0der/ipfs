import pg from "pg"

const DbGen = () => {
    // creating new pg client instance
    const DbClient = new pg.Client({
        host: "localhost",
        port: 5432,
        user: "postgres",
        password: "admin",
        database: "resume_inc",
    })
    return DbClient
}

export default DbGen
