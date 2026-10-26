import {supabaseBrowser} from './supabase';

export async function uploadWeeklyCatalog(file,onProgress=()=>{}) {
  const supabase=supabaseBrowser();
  const {data:{session},error:sessionError}=await supabase.auth.getSession();
  if (sessionError||!session?.user||!session.access_token) throw new Error('Inicia sesión para subir el catálogo.');
  if (file.size>200*1024*1024) throw new Error('El archivo supera 200 MB.');
  const extension=(file.name.match(/\.(pptx|pdf|xlsx|csv)$/i)||[])[0]?.toLowerCase();
  if (!extension) throw new Error('Formato admitido: PPTX, PDF, XLSX o CSV.');
  const storagePath=`entrantes/${session.user.id}/${crypto.randomUUID()}${extension}`;
  const contentType={'.pptx':'application/vnd.openxmlformats-officedocument.presentationml.presentation','.pdf':'application/pdf','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','.csv':'text/csv'}[extension];
  if (file.size<=6*1024*1024) {
    const uploaded=await supabase.storage.from('aliados-catalogos').upload(storagePath,file,{contentType,upsert:false});
    if (uploaded.error) throw uploaded.error;
    onProgress(1);
  } else {
    const {Upload}=await import('tus-js-client');
    await new Promise((resolve,reject)=>{
      const upload=new Upload(file,{
        endpoint:`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/upload/resumable`,
        chunkSize:6*1024*1024,
        retryDelays:[0,3000,5000,10000,20000],
        headers:{authorization:`Bearer ${session.access_token}`,apikey:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,'x-upsert':'false'},
        metadata:{bucketName:'aliados-catalogos',objectName:storagePath,contentType,cacheControl:'3600'},
        removeFingerprintOnSuccess:true,
        onError:reject,
        onProgress:(sent,total)=>onProgress(total?sent/total:0),
        onSuccess:resolve,
      });
      upload.start();
    });
  }
  return storagePath;
}
