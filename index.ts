import app from './src/app';
import {PORT} from "./env";






app.listen(PORT,() => {
    console.log(`server is running on port ${PORT}`);
})
