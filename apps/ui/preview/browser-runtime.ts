export const getBrowserVaultBinding = () => 'preview-only-binding';
export const readBrowserAsset = async (path:string) => {
  if (path !== 'assets/loading-preview.png') throw new Error('模拟附件尚未下载。');
  await new Promise(resolve => setTimeout(resolve, 2000));
  const response = await fetch('/favicon.png');
  return response.blob();
};
