
import jsPDF from 'jspdf'
import 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export const ReportService = {
    // Generate PDF Report
    generatePDF: (data, title, stats) => {
        const doc = new jsPDF()
        const now = format(new Date(), 'dd/MM/yyyy HH:mm')

        // Header Background
        doc.setFillColor(79, 70, 229) // Indigo-600
        doc.rect(0, 0, 210, 40, 'F')

        // Title
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(22)
        doc.text('PitonB - Reporte Estratégico', 15, 20)

        doc.setFontSize(10)
        doc.text(`Generado: ${now}`, 15, 30)

        // Summary Stats Section
        doc.setTextColor(0, 0, 0)
        doc.setFontSize(14)
        doc.text('Resumen General', 15, 55)

        doc.setFontSize(10)
        doc.text(`Total Ventas: $${stats.totalSales.toLocaleString('es-CL')}`, 15, 65)
        doc.text(`Total Órdenes: ${stats.totalOrders}`, 80, 65)
        doc.text(`Saldo Pendiente: $${stats.pendingBalance.toLocaleString('es-CL')}`, 140, 65)

        // Table
        const tableColumn = ["ID", "Cliente", "Descripción", "Estado", "Total", "Fecha"]
        const tableRows = data.map(order => [
            order.id.slice(0, 5),
            order.leads?.name || 'S/N',
            order.description?.slice(0, 30) + '...',
            order.status.toUpperCase(),
            `$${(order.total_amount || 0).toLocaleString('es-CL')}`,
            format(new Date(order.created_at), 'dd/MM/yyyy')
        ])

        doc.autoTable({
            startY: 75,
            head: [tableColumn],
            body: tableRows,
            theme: 'grid',
            headStyles: { fillColor: [79, 70, 229], fontSize: 10 },
            styles: { fontSize: 8 },
            alternateRowStyles: { fillColor: [249, 250, 251] }
        })

        doc.save(`Reporte_PitonB_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`)
    },

    // Generate Excel Report
    generateExcel: (data) => {
        const worksheet = XLSX.utils.json_to_sheet(data.map(order => ({
            ID: order.id,
            Cliente: order.leads?.name,
            Telefono: order.leads?.phone_number,
            Descripcion: order.description,
            Estado: order.status,
            Total: order.total_amount,
            Abono: order.deposit_amount,
            Saldo: (order.total_amount || 0) - (order.deposit_amount || 0),
            Fecha: format(new Date(order.created_at), 'dd/MM/yyyy HH:mm')
        })))

        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, "Órdenes")

        XLSX.writeFile(workbook, `PitonB_Export_${format(new Date(), 'yyyyMMdd')}.xlsx`)
    },

    // 3. Generate Audit Excel
    generateAuditExcel: (logs) => {
        const data = logs.map(log => ({
            Fecha: format(new Date(log.created_at), 'dd/MM/yyyy HH:mm'),
            Orden: log.order_id?.slice(0, 8),
            Cliente: log.orders?.leads?.name || 'Sistema',
            Tipo: log.change_type,
            Detalles: log.details,
            Usuario: log.changed_by
        }))

        const worksheet = XLSX.utils.json_to_sheet(data)
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, "Auditoria")

        XLSX.writeFile(workbook, `PitonB_Auditoria_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`)
    }
}

