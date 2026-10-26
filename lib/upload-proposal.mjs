import {Upload} from 'tus-js-client';

const MIME='application/vnd.openxmlformats-officedocument.presentationml.presentation';

export async function uploadProposal({admin,path,output}) {
  if (output.length<=6*1024*1024) {
    const result=await admin.storage.from('aliados-catalogos').upload(path,output,{contentType:MIME,upsert:false});
    if (result.error) throw result.error;
    return;
  }
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url||!key) throw new Error('Falta la configuración de Supabase');
  await new Promise((resolve,reject)=>{
    const upload=new Upload(output,{
      endpoint:`${url}/storage/v1/upload/resumable`,
      chunkSize:6*1024*1024,
      retryDelays:[0,3000,5000,10000],
      headers:{authorization:`Bearer ${key}`,apikey:key,'x-upsert':'false'},
      metadata:{bucketName:'aliados-catalogos',objectName:path,contentType:MIME,cacheControl:'3600'},
      uploadSize:output.length,
      onError:reject,
      onSuccess:resolve,
    });
    upload.start();
  });
}
