const Attendance = require('../models/Attendance');
const User = require('../models/User');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

// @desc    Get attendance summary report by date range
// @route   GET /api/reports/summary
// @access  Staff/Admin
const getAttendanceSummary = async (req, res) => {
    const { startDate, endDate, department, year, section } = req.query;

    try {
        // Build student filter
        const studentFilter = { role: 'student' };
        if (department) studentFilter.department = department;
        if (year) studentFilter.year = year.toString();
        if (section) studentFilter.section = section.toString();

        const students = await User.find(studentFilter).select('_id name rollNumber department year section');
        const studentIds = students.map(s => s._id);

        // Build date filter
        const dateFilter = {};
        if (startDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            dateFilter.$gte = start;
        }
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            dateFilter.$lte = end;
        }

        const attendanceQuery = { student: { $in: studentIds } };
        if (Object.keys(dateFilter).length > 0) {
            attendanceQuery.date = dateFilter;
        }

        const attendanceRecords = await Attendance.find(attendanceQuery);

        // Calculate summary per student
        const summary = students.map(student => {
            const studentAttendance = attendanceRecords.filter(
                a => a.student.toString() === student._id.toString()
            );

            const present = studentAttendance.filter(a => a.status === 'Present').length;
            const absent = studentAttendance.filter(a => a.status === 'Absent').length;
            const halfDay = studentAttendance.filter(a => a.status === 'Half Day').length;
            const leave = studentAttendance.filter(a => a.status === 'Leave').length;
            const total = present + absent + halfDay + leave;

            return {
                _id: student._id,
                name: student.name,
                rollNumber: student.rollNumber,
                department: student.department,
                year: student.year,
                section: student.section,
                present,
                absent,
                halfDay,
                leave,
                total,
                percentage: total > 0 ? ((present + halfDay * 0.5) / total * 100).toFixed(2) : 0
            };
        });

        // Overall stats
        const totalPresent = summary.reduce((sum, s) => sum + s.present, 0);
        const totalAbsent = summary.reduce((sum, s) => sum + s.absent, 0);
        const totalHalfDay = summary.reduce((sum, s) => sum + s.halfDay, 0);
        const totalLeave = summary.reduce((sum, s) => sum + s.leave, 0);

        res.json({
            students: summary,
            overall: {
                totalStudents: students.length,
                totalRecords: attendanceRecords.length,
                present: totalPresent,
                absent: totalAbsent,
                halfDay: totalHalfDay,
                leave: totalLeave
            },
            dateRange: {
                start: startDate || 'All time',
                end: endDate || 'Present'
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Export attendance to Excel
// @route   GET /api/reports/export/excel
// @access  Staff/Admin
const exportToExcel = async (req, res) => {
    const { startDate, endDate, department, year, section } = req.query;

    try {
        // Build student filter
        const studentFilter = { role: 'student' };
        if (department) studentFilter.department = department;
        if (year) studentFilter.year = year.toString();
        if (section) studentFilter.section = section.toString();

        const students = await User.find(studentFilter)
            .select('_id name rollNumber department year section')
            .sort({ rollNumber: 1 });
        const studentIds = students.map(s => s._id);

        // Build date filter
        const dateFilter = {};
        if (startDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            dateFilter.$gte = start;
        }
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            dateFilter.$lte = end;
        }

        const attendanceQuery = { student: { $in: studentIds } };
        if (Object.keys(dateFilter).length > 0) {
            attendanceQuery.date = dateFilter;
        }

        const attendanceRecords = await Attendance.find(attendanceQuery).sort({ date: 1 });

        // Create workbook using exceljs
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Attendance Management System';
        workbook.created = new Date();

        const worksheet = workbook.addWorksheet('Attendance Report');

        // Define columns
        worksheet.columns = [
            { header: 'Roll Number', key: 'rollNumber', width: 15 },
            { header: 'Name', key: 'name', width: 25 },
            { header: 'Department', key: 'department', width: 15 },
            { header: 'Year', key: 'year', width: 8 },
            { header: 'Section', key: 'section', width: 10 },
            { header: 'Present', key: 'present', width: 10 },
            { header: 'Absent', key: 'absent', width: 10 },
            { header: 'Half Day', key: 'halfDay', width: 10 },
            { header: 'Leave', key: 'leave', width: 10 },
            { header: 'Total Days', key: 'total', width: 12 },
            { header: 'Percentage', key: 'percentage', width: 12 }
        ];

        // Style header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        // Add data rows
        students.forEach(student => {
            const studentAttendance = attendanceRecords.filter(
                a => a.student.toString() === student._id.toString()
            );

            const present = studentAttendance.filter(a => a.status === 'Present').length;
            const absent = studentAttendance.filter(a => a.status === 'Absent').length;
            const halfDay = studentAttendance.filter(a => a.status === 'Half Day').length;
            const leave = studentAttendance.filter(a => a.status === 'Leave').length;
            const total = present + absent + halfDay + leave;

            worksheet.addRow({
                rollNumber: student.rollNumber,
                name: student.name,
                department: student.department,
                year: student.year,
                section: student.section,
                present,
                absent,
                halfDay,
                leave,
                total,
                percentage: total > 0 ? `${((present + halfDay * 0.5) / total * 100).toFixed(2)}%` : '0%'
            });
        });

        // Generate buffer
        const buffer = await workbook.xlsx.writeBuffer();

        // Set response headers
        const filename = `Attendance_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Export attendance to PDF
// @route   GET /api/reports/export/pdf
// @access  Staff/Admin
const exportToPDF = async (req, res) => {
    const { startDate, endDate, department, year, section } = req.query;

    try {
        // Build student filter
        const studentFilter = { role: 'student' };
        if (department) studentFilter.department = department;
        if (year) studentFilter.year = year.toString();
        if (section) studentFilter.section = section.toString();

        const students = await User.find(studentFilter)
            .select('_id name rollNumber department year section')
            .sort({ rollNumber: 1 });
        const studentIds = students.map(s => s._id);

        // Build date filter
        const dateFilter = {};
        if (startDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            dateFilter.$gte = start;
        }
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            dateFilter.$lte = end;
        }

        const attendanceQuery = { student: { $in: studentIds } };
        if (Object.keys(dateFilter).length > 0) {
            attendanceQuery.date = dateFilter;
        }

        const attendanceRecords = await Attendance.find(attendanceQuery);

        // Create PDF
        const doc = new PDFDocument({ margin: 50, size: 'A4' });

        // Set response headers
        const filename = `Attendance_Report_${new Date().toISOString().split('T')[0]}.pdf`;
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/pdf');

        doc.pipe(res);

        // Title
        doc.fontSize(20).font('Helvetica-Bold').text('Attendance Report', { align: 'center' });
        doc.moveDown();

        // Date range
        doc.fontSize(12).font('Helvetica').text(
            `Date Range: ${startDate || 'Start'} to ${endDate || 'Present'}`,
            { align: 'center' }
        );

        // Filters applied
        if (department || year || section) {
            doc.fontSize(10).text(
                `Filters: ${department ? `Department: ${department}` : ''} ${year ? `Year: ${year}` : ''} ${section ? `Section: ${section}` : ''}`.trim(),
                { align: 'center' }
            );
        }

        doc.moveDown(2);

        // Table header
        const tableTop = doc.y;
        const columnWidths = [80, 120, 50, 50, 50, 50, 60];
        const headers = ['Roll No', 'Name', 'Present', 'Absent', 'Half Day', 'Leave', 'Percentage'];

        doc.fontSize(10).font('Helvetica-Bold');

        let xPos = 50;
        headers.forEach((header, i) => {
            doc.text(header, xPos, tableTop, { width: columnWidths[i], align: 'left' });
            xPos += columnWidths[i];
        });

        // Draw line under header
        doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).stroke();

        // Table rows
        doc.font('Helvetica').fontSize(9);
        let yPos = tableTop + 25;

        students.forEach((student, index) => {
            // Check if we need a new page
            if (yPos > 750) {
                doc.addPage();
                yPos = 50;
            }

            const studentAttendance = attendanceRecords.filter(
                a => a.student.toString() === student._id.toString()
            );

            const present = studentAttendance.filter(a => a.status === 'Present').length;
            const absent = studentAttendance.filter(a => a.status === 'Absent').length;
            const halfDay = studentAttendance.filter(a => a.status === 'Half Day').length;
            const leave = studentAttendance.filter(a => a.status === 'Leave').length;
            const total = present + absent + halfDay + leave;
            const percentage = total > 0 ? ((present + halfDay * 0.5) / total * 100).toFixed(1) : 0;

            const rowData = [
                student.rollNumber,
                student.name.substring(0, 20),
                present.toString(),
                absent.toString(),
                halfDay.toString(),
                leave.toString(),
                `${percentage}%`
            ];

            xPos = 50;
            rowData.forEach((data, i) => {
                doc.text(data, xPos, yPos, { width: columnWidths[i], align: 'left' });
                xPos += columnWidths[i];
            });

            yPos += 18;
        });

        // Summary section
        doc.addPage();
        doc.fontSize(16).font('Helvetica-Bold').text('Summary', { align: 'center' });
        doc.moveDown();

        const totalPresent = students.reduce((sum, student) => {
            const studentAttendance = attendanceRecords.filter(a => a.student.toString() === student._id.toString());
            return sum + studentAttendance.filter(a => a.status === 'Present').length;
        }, 0);

        const totalAbsent = students.reduce((sum, student) => {
            const studentAttendance = attendanceRecords.filter(a => a.student.toString() === student._id.toString());
            return sum + studentAttendance.filter(a => a.status === 'Absent').length;
        }, 0);

        doc.fontSize(12).font('Helvetica');
        doc.text(`Total Students: ${students.length}`);
        doc.text(`Total Attendance Records: ${attendanceRecords.length}`);
        doc.text(`Total Present: ${totalPresent}`);
        doc.text(`Total Absent: ${totalAbsent}`);
        doc.moveDown();
        doc.fontSize(10).text(`Generated on: ${new Date().toLocaleString()}`);

        doc.end();
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get daily attendance report
// @route   GET /api/reports/daily
// @access  Staff/Admin
const getDailyReport = async (req, res) => {
    const { date, department, year, section } = req.query;

    try {
        const reportDate = date ? new Date(date) : new Date();
        reportDate.setHours(0, 0, 0, 0);
        const nextDay = new Date(reportDate);
        nextDay.setDate(nextDay.getDate() + 1);

        // Build student filter
        const studentFilter = { role: 'student' };
        if (department) studentFilter.department = department;
        if (year) studentFilter.year = year.toString();
        if (section) studentFilter.section = section.toString();

        const students = await User.find(studentFilter)
            .select('_id name rollNumber department year section profilePhoto')
            .sort({ rollNumber: 1 });
        const studentIds = students.map(s => s._id);

        // Get attendance for the day
        const attendanceRecords = await Attendance.find({
            student: { $in: studentIds },
            date: { $gte: reportDate, $lt: nextDay }
        });

        // Map students with their attendance status
        const report = students.map(student => {
            const attendance = attendanceRecords.find(
                a => a.student.toString() === student._id.toString()
            );

            return {
                _id: student._id,
                name: student.name,
                rollNumber: student.rollNumber,
                department: student.department,
                year: student.year,
                section: student.section,
                profilePhoto: student.profilePhoto,
                status: attendance ? attendance.status : 'Not Marked',
                time: attendance ? attendance.time : null,
                isManual: attendance ? attendance.isManual : false
            };
        });

        // Summary
        const present = report.filter(r => r.status === 'Present').length;
        const absent = report.filter(r => r.status === 'Absent').length;
        const halfDay = report.filter(r => r.status === 'Half Day').length;
        const leave = report.filter(r => r.status === 'Leave').length;
        const notMarked = report.filter(r => r.status === 'Not Marked').length;

        res.json({
            date: reportDate.toISOString().split('T')[0],
            students: report,
            summary: {
                total: students.length,
                present,
                absent,
                halfDay,
                leave,
                notMarked
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getAttendanceSummary,
    exportToExcel,
    exportToPDF,
    getDailyReport
};
