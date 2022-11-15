const AWS = require("aws-sdk");

const { INVALID_REQUEST } = require("./createError");

const getS3Credential = async () => {
  try {
    const sManager = new AWS.SecretsManager();

    const variables = await sManager
      .getSecretValue({ SecretId: `${process.env.STAGE}/S3uploadKey` })
      .promise();

    return JSON.parse(variables.SecretString);
  } catch (error) {
    console.log("Error while getting S3 Credential::", error);
  }
};

const initiateS3 = async () => {
  try {
    const {
      AWS_ACCESS_KEY,
      AWS_SECRET_ACCESS_KEY,
      AWS_REGION,
      AWS_STORAGE_BUCKET_NAME,
    } = await getS3Credential();

    const storage = new AWS.S3({
      accessKeyId: AWS_ACCESS_KEY,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
      region: AWS_REGION,
    });

    return [storage, AWS_STORAGE_BUCKET_NAME];
  } catch (error) {
    console.log("Error while initiating S3:::", error);
  }
};

const uploadFile = async (fileName, file) => {
  try {
    const [s3, bucket] = await initiateS3();

    let uploaded = await s3
      .upload({
        Bucket: bucket,
        Key: "media/" + fileName,
        Body: file,
      })
      .promise();

    console.log("file uploaded successfully:::", uploaded.Location);
  } catch (error) {
    console.log("Error while uploading file:::", error);
  }
};

const isBase64 = (file) => {
  return typeof file === "string" && file.includes("base64");
};

const getMetaDataFromBase64File = (file) => {
  if (!isBase64(file)) throw INVALID_REQUEST("file must be a base64 string!");

  let [type, format] = file.split(";")[0].split("/");

  if (format === 'svg+xml') format = 'svg'
  if (format === 'plain') format = 'txt'
  if (format === 'vnd.openxmlformats-officedocument.spreadsheetml.sheet') format = 'xlsx'
  if (format === 'vnd.openxmlformats-officedocument.wordprocessingml.document') format = 'docx'
  if (format === 'msword') format = 'doc'

  return [type, format];
};

const generateFileFromBase64 = (base64Str, type) => {
  if (!isBase64(base64Str)) throw INVALID_REQUEST("file must be a base64 string!");

  // Convert base64 to buffer file
  const fileString = base64Str.split(';base64,').pop()

  console.log("file as string:::", fileString);

  const file = new Buffer.from(fileString, "base64");

  return file;
};

module.exports = {
  isBase64,
  uploadFile,
  generateFileFromBase64,
  getMetaDataFromBase64File,
};
