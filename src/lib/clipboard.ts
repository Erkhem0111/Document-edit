// navigator.clipboard нь зөвхөн https эсвэл localhost дээр ажилладаг.
// http://192.168.x.x гэх мэт дотоод сүлжээний хаягаар нээвэл байхгүй тул
// хуучин textarea + execCommand аргаар нөөцлөнө.
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // доорх нөөц арга руу орно
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
