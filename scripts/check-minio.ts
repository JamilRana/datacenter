import "dotenv/config";
import { Client } from "minio";

const minioEndpoint = process.env.MINIO_ENDPOINT || "localhost";
const minioPort = parseInt(process.env.MINIO_PORT || "9000");
const minioAccessKey = process.env.MINIO_ACCESS_KEY || "minioadmin";
const minioSecretKey = process.env.MINIO_SECRET_KEY || "minioadmin";
const minioBucket = process.env.MINIO_BUCKET || "datacenter";

const client = new Client({
  endPoint: minioEndpoint,
  port: minioPort,
  useSSL: false,
  accessKey: minioAccessKey,
  secretKey: minioSecretKey,
});

async function ensureBucket() {
  console.log("Checking bucket:", minioBucket);
  const exists = await client.bucketExists(minioBucket);
  console.log("Bucket exists:", exists);
  
  if (!exists) {
    console.log("Creating bucket...");
    await client.makeBucket(minioBucket);
    console.log("Bucket created!");
  } else {
    console.log("Bucket already exists");
  }
  
  // List objects
  const stream = client.listObjects(minioBucket, "", true);
  const objects: any[] = [];
  await new Promise((resolve, reject) => {
    stream.on("data", (obj) => objects.push(obj));
    stream.on("end", resolve);
    stream.on("error", reject);
  });
  
  console.log("Objects in bucket:", objects.length);
  objects.forEach(obj => console.log(" -", obj.name));
}

ensureBucket().catch(console.error);