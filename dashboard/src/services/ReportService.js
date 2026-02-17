
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export const ReportService = {
    // 1. Generate PDF Report
    generatePDF: async (data, title, stats) => {
        try {
            const doc = new jsPDF()
            const now = format(new Date(), 'dd/MM/yyyy HH:mm')

            // Helper to load image
            const loadImage = (src) => {
                return new Promise((resolve) => {
                    const img = new Image()
                    img.src = src
                    img.onload = () => resolve(img)
                    img.onerror = () => resolve(null)
                })
            }

            const logo = await loadImage('/logo.png')

            // Header Background
            doc.setFillColor(79, 70, 229) // Indigo-600
            doc.rect(0, 0, 210, 40, 'F')

            // Logo (if available)
            if (logo) {
                // Background for logo to make it pop if it's dark
                doc.setFillColor(255, 255, 255)
                doc.roundedRect(170, 5, 30, 30, 5, 5, 'F')
                doc.addImage(logo, 'PNG', 172, 7, 26, 26)
            }

            // Title
            doc.setTextColor(255, 255, 255)
            doc.setFontSize(22)
            doc.text('PitonB - ' + (title || 'Reporte'), 15, 20)

            doc.setFontSize(10)
            doc.text(`Generado: ${now}`, 15, 30)

            // Summary Stats Section
            doc.setTextColor(0, 0, 0)
            doc.setFontSize(14)
            doc.text('Resumen General', 15, 55)

            doc.setFontSize(10)
            doc.text(`Total Ventas: $${(stats?.totalSales || 0).toLocaleString('es-CL')}`, 15, 65)
            doc.text(`Total Órdenes: ${stats?.totalOrders || 0}`, 80, 65)
            doc.text(`Saldo Pendiente: $${(stats?.pendingBalance || 0).toLocaleString('es-CL')}`, 140, 65)

            // Table
            const tableColumn = ["ID", "Cliente", "Descripción", "Estado", "Total", "Fecha"]
            const tableRows = data.map(order => [
                (order.id || '').slice(0, 5),
                order.leads?.name || 'S/N',
                (order.description || '-').slice(0, 30) + (order.description?.length > 30 ? '...' : ''),
                (order.status || 'new').toUpperCase(),
                `$${(order.total_amount || 0).toLocaleString('es-CL')}`,
                order.created_at ? format(new Date(order.created_at), 'dd/MM/yyyy') : '-'
            ])

            autoTable(doc, {
                startY: 75,
                head: [tableColumn],
                body: tableRows,
                theme: 'grid',
                headStyles: { fillColor: [79, 70, 229], fontSize: 10 },
                styles: { fontSize: 8 },
                alternateRowStyles: { fillColor: [249, 250, 251] }
            })

            doc.save(`Reporte_PitonB_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`)
        } catch (error) {
            console.error("Error generating PDF:", error)
            throw error
        }
    },

    // 2. Generate Orders Excel
    generateOrdersExcel: (data) => {
        const worksheet = XLSX.utils.json_to_sheet(data.map(order => ({
            ID: order.id.slice(0, 8),
            Cliente: order.leads?.name || 'S/N',
            Telefono: order.leads?.phone_number || '-',
            Descripcion: order.description || '-',
            Estado: (order.status || 'new').toUpperCase(),
            Total: order.total_amount || 0,
            Abono: order.deposit_amount || 0,
            Saldo: (order.total_amount || 0) - (order.deposit_amount || 0),
            Fecha: format(new Date(order.created_at), 'dd/MM/yyyy HH:mm')
        })))

        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, "Órdenes")

        XLSX.writeFile(workbook, `PitonB_Ordenes_${format(new Date(), 'yyyyMMdd')}.xlsx`)
    },

    // 3. Generate Leads Excel
    generateLeadsExcel: (leads) => {
        const worksheet = XLSX.utils.json_to_sheet(leads.map(l => ({
            ID: l.id.slice(0, 8),
            Nombre: l.name || 'Sin nombre',
            Telefono: l.phone_number || '-',
            Empresa: l.business_name || '-',
            Email: l.email || '-',
            Nota: l.notes || '-',
            Fecha_Registro: format(new Date(l.created_at), 'dd/MM/yyyy')
        })))

        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, "Clientes")

        XLSX.writeFile(workbook, `PitonB_Clientes_${format(new Date(), 'yyyyMMdd')}.xlsx`)
    },

    // 4. Generate Audit Excel
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

