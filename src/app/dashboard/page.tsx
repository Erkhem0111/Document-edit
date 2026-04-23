import { auth } from "@/auth";

export default async function DashboardPage() {
  const session = await auth();

  const files = [
    {
      id: 1,
      name: "Database_Migration_Final.sql",
      size: "2.4 MB",
      type: "SQL",
      date: "2026-04-20",
    },
    {
      id: 2,
      name: "System_Architecture_v2.pdf",
      size: "15.8 MB",
      type: "PDF",
      date: "2026-04-19",
    },
    {
      id: 3,
      name: "User_Management_Module.ts",
      size: "45 KB",
      type: "TS",
      date: "2026-04-21",
    },
    {
      id: 4,
      name: "Industrial_UI_Asset_Pack.zip",
      size: "124 MB",
      type: "ZIP",
      date: "2026-04-18",
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          {
            label: "Нийт Файл",
            value: "1,284",
            color: "from-gray-700 to-black",
          },
          {
            label: "Хадгалах зай",
            value: "84%",
            color: "from-blue-600 to-indigo-700",
          },
          {
            label: "Идэвхтэй Процесс",
            value: "12",
            color: "from-emerald-500 to-teal-600",
          },
        ].map((stat, i) => (
          <div
            key={i}
            className="bg-white p-6 rounded-[24px] border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
          >
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              {stat.label}
            </p>
            <h3 className="text-3xl font-black text-gray-900 mt-2">
              {stat.value}
            </h3>
          </div>
        ))}
      </div>

      {/* File List Section - Windows 11 Inspired */}
      <div className="bg-white rounded-[24px] border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
          <h3 className="font-bold text-gray-800">Сүүлийн файлууд</h3>
          <button className="text-xs font-bold text-blue-600 hover:underline">
            Бүгдийг үзэх
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-gray-400 bg-gray-50/30">
                <th className="px-6 py-3 font-bold">Нэр</th>
                <th className="px-6 py-3 font-bold">Төрөл</th>
                <th className="px-6 py-3 font-bold">Хэмжээ</th>
                <th className="px-6 py-3 font-bold">Огноо</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {files.map((file) => (
                <tr
                  key={file.id}
                  className="hover:bg-blue-50/30 transition-colors cursor-pointer group"
                >
                  <td className="px-6 py-4 flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center text-[10px] font-bold text-gray-500 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                      {file.type}
                    </div>
                    <span className="text-sm font-medium text-gray-700">
                      {file.name}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-500">
                    {file.type}
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-500">
                    {file.size}
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-500">
                    {file.date}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
