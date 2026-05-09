declare module 'backblaze-b2' {
  interface B2Config {
    applicationKeyId: string;
    applicationKey: string;
  }

  interface AuthorizationData {
    absoluteMinimumPartSize: number;
    accountId: string;
    allowed: any;
    apiUrl: string;
    authorizationToken: string;
    downloadUrl: string;
    recommendedPartSize: number;
    s3ApiUrl: string;
  }

  interface AuthorizationResponse {
    data: AuthorizationData;
  }

  interface UploadUrlData {
    uploadUrl: string;
    authorizationToken: string;
  }

  interface UploadUrlResponse {
    data: UploadUrlData;
  }

  interface UploadFileOptions {
    uploadUrl: string;
    uploadAuthToken: string;
    fileName: string;
    data: Buffer;
    contentType?: string;
  }

  interface UploadFileData {
    fileId: string;
    fileName: string;
    uploadTimestamp: number;
    action: string;
  }

  interface UploadFileResponse {
    data: UploadFileData;
  }

  interface ListFileNamesOptions {
    bucketId: string;
    startFileName?: string;
    prefix?: string;
    maxFileCount?: number;
  }

  interface B2File {
    fileId: string;
    fileName: string;
    action: string;
    size: number;
    uploadTimestamp: number;
  }

  interface ListFileNamesData {
    files: B2File[];
    nextFileName?: string;
  }

  interface ListFileNamesResponse {
    data: ListFileNamesData;
  }

  interface DeleteFileVersionOptions {
    fileId: string;
    fileName: string;
  }

  interface DeleteFileVersionResponse {
    data: any;
  }

  class B2 {
    constructor(config: B2Config);
    authorize(): Promise<AuthorizationResponse>;
    getUploadUrl(options: { bucketId: string }): Promise<UploadUrlResponse>;
    uploadFile(options: UploadFileOptions): Promise<UploadFileResponse>;
    listFileNames(options: ListFileNamesOptions): Promise<ListFileNamesResponse>;
    deleteFileVersion(options: DeleteFileVersionOptions): Promise<DeleteFileVersionResponse>;
  }

  export = B2;
}



