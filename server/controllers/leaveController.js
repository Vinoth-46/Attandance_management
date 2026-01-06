const Leave = require('../models/Leave');

// @desc    Apply for leave
// @route   POST /api/leaves
// @access  Student
const applyLeave = async (req, res) => {
    const { startDate, endDate, reason, attachment } = req.body;

    try {
        const leave = await Leave.create({
            student: req.user.id,
            startDate,
            endDate,
            reason,
            attachment,
        });

        res.status(201).json(leave);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get my leave history
// @route   GET /api/leaves/my
// @access  Student
const getMyLeaves = async (req, res) => {
    try {
        const leaves = await Leave.find({ student: req.user.id }).sort({ createdAt: -1 });
        res.json(leaves);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all pending leaves
// @route   GET /api/leaves/pending
// @access  Staff/Admin
const getPendingLeaves = async (req, res) => {
    try {
        const leaves = await Leave.find({ status: 'Pending' })
            .populate('student', 'name rollNumber department year section')
            .sort({ createdAt: 1 });
        res.json(leaves);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all approved leaves
// @route   GET /api/leaves/approved
// @access  Staff/Admin
const getApprovedLeaves = async (req, res) => {
    try {
        const leaves = await Leave.find({ status: 'Approved' })
            .populate('student', 'name rollNumber department year section')
            .populate('approvedBy', 'name')
            .sort({ updatedAt: -1 });
        res.json(leaves);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all rejected leaves
// @route   GET /api/leaves/rejected
// @access  Staff/Admin
const getRejectedLeaves = async (req, res) => {
    try {
        const leaves = await Leave.find({ status: 'Rejected' })
            .populate('student', 'name rollNumber department year section')
            .populate('approvedBy', 'name')
            .sort({ updatedAt: -1 });
        res.json(leaves);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update leave status (Approve/Reject)
// @route   PUT /api/leaves/:id
// @access  Staff/Admin
const updateLeaveStatus = async (req, res) => {
    const { status, rejectionReason } = req.body;

    try {
        const leave = await Leave.findById(req.params.id);

        if (!leave) {
            return res.status(404).json({ message: 'Leave request not found' });
        }

        leave.status = status;
        if (status === 'Rejected') {
            if (!rejectionReason || rejectionReason.trim() === '') {
                return res.status(400).json({ message: 'Rejection reason is required' });
            }
            leave.rejectionReason = rejectionReason;
        }
        leave.approvedBy = req.user.id;

        await leave.save();
        res.json(leave);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all deleted leaves
// @route   GET /api/leaves/deleted
// @access  Staff/Admin
const getDeletedLeaves = async (req, res) => {
    try {
        const leaves = await Leave.find({ status: 'Deleted' })
            .populate('student', 'name rollNumber department year section')
            .populate('approvedBy', 'name')
            .sort({ updatedAt: -1 });
        res.json(leaves);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Soft delete a leave request
// @route   DELETE /api/leaves/:id
// @access  Staff/Admin
const deleteLeave = async (req, res) => {
    try {
        const leave = await Leave.findById(req.params.id);

        if (!leave) {
            return res.status(404).json({ message: 'Leave request not found' });
        }

        leave.status = 'Deleted';
        await leave.save();

        // Real-time update: Notify the student
        const io = req.app.get('io');
        if (io) {
            io.to(leave.student.toString()).emit('leave:updated', {
                message: 'Your leave request has been moved to trash',
                leaveId: leave._id,
                status: 'Deleted'
            });
        }

        res.json({ message: 'Leave moved to trash', id: req.params.id });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Bulk delete leaves (e.g., Delete Last Week)
// @route   DELETE /api/leaves/bulk
// @access  Staff/Admin
const bulkDeleteLeaves = async (req, res) => {
    const { criteria } = req.body; // e.g., 'last-week'

    try {
        let filter = {};

        if (criteria === 'last-week') {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

            // Delete leaves created in the last week that are not already deleted
            filter = {
                createdAt: { $gte: oneWeekAgo },
                status: { $ne: 'Deleted' }
            };
        } else {
            return res.status(400).json({ message: 'Invalid bulk delete criteria' });
        }

        const result = await Leave.updateMany(filter, { status: 'Deleted' });

        res.json({ message: `Moved ${result.modifiedCount} leaves to trash` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    applyLeave,
    getMyLeaves,
    getPendingLeaves,
    getApprovedLeaves,
    getRejectedLeaves,
    getDeletedLeaves,
    updateLeaveStatus,
    deleteLeave,
    bulkDeleteLeaves
};
