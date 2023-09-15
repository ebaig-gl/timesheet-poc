const express = require("express");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("hello there!");
});

app.post("/submittimesheet", async (req, res) => {
  try {
    const {
      projectCode,
      totalHours,
      jobCode,
      hours = [],
      employeeName,
      dateRange,
      viewDetails = "",
      comments = "",
      isChecked = false,
      status = "Pending",
      timesheetRows = [],
    } = req.body;

    let existingEmployee = await prisma.employeeName.findFirst({
      where: { name: employeeName },
    });

    if (!existingEmployee) {
      existingEmployee = await prisma.employeeName.create({
        data: {
          name: employeeName,
        },
      });
    }

    const existingEntries = await prisma.timesheetData.findMany({
      where: {
        dateRange: {
          equals: dateRange,
        },
        empCode: existingEmployee.id,
      },
    });

    let newData = {
      projectCode,
      totalHours,
      jobCode,
      hours,
      dateRange,
      viewDetails,
      comments,
      isChecked,
      status,
      timesheetRows,
      empCode: existingEmployee.id,
    };

    if (existingEntries.length > 0) {
      const existingEntry = existingEntries[0];
      await prisma.timesheetData.update({
        where: { id: existingEntry.id },
        data: newData,
      });
    } else {
      await prisma.timesheetData.create({
        data: newData,
      });
    }

    res
      .status(201)
      .json({ success: true, message: "Timesheet is successfully submitted" });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message || error,
    });
    console.error("Submitting Error:", error);
  }
});

app.get("/getInitialData", async (req, res) => {
  try {
    const empName = req.query.employeeName;
    const dateRanges = req.query.dateRange;

    if (!empName || !dateRanges) {
      return res.status(400).json({
        success: false,
        message: "Please provide an employeeName and at least one dateRange.",
      });
    }

    const employee = await prisma.employeeName.findFirst({
      where: {
        name: empName,
      },
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found.",
      });
    }

    const empCode = employee.id;

    const timesheetData = await prisma.timesheetData.findFirst({
      where: {
        empCode: empCode,
        dateRange: {
          equals: dateRanges,
        },
      },
    });

    res.status(200).json(timesheetData);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Oops! There was some error while fetching the timesheet.",
    });
    console.error("Get Timesheet Error:", error);
  }
});

app.get("/getAllData", async (req, res) => {
  try {
    const dateRanges = req.query.dateRange;

    if (!dateRanges) {
      return res.status(400).json({
        success: false,
        message: "Please provide an dateRange.",
      });
    }

    const timesheetData = await prisma.timesheetData.findMany({
      where: {
        dateRange: {
          equals: dateRanges,
        },
      },
    });

    res.status(200).json(timesheetData);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Oops! There was some error while fetching the timesheet.",
    });
    console.error("Get Timesheet Error:", error);
  }
});

app.post("/onApproveOrReject", async (req, res) => {
  try {
    const { dateRange, empName, action } = req.body;

    if (!dateRange || !empName || !action) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide 'dateRange', 'empName', and 'action' in the request body.",
      });
    }

    const existingTimesheetEntry = await prisma.timesheetData.findMany({
      where: {
        dateRange: {
          equals: dateRange,
        },
        empName: {
          has: empName[0],
        },
        status: {
          equals: "Pending",
        },
      },
    });

    if (!existingTimesheetEntry.length) {
      return res.status(404).json({
        success: false,
        message:
          "Timesheet entry not found or not in a pending state for the specified dateRange and empName.",
      });
    }

    let updatedStatus;
    if (action === "Approve") {
      updatedStatus = "Approved";
    } else if (action === "Reject") {
      updatedStatus = "Rejected";
    } else {
      return res.status(400).json({
        success: false,
        message:
          "Invalid 'action' provided. It should be 'Approve' or 'Reject'.",
      });
    }

    const updatedTimesheetEntry = await prisma.timesheetData.update({
      where: { id: existingTimesheetEntry[0].id },
      data: { status: updatedStatus },
    });

    res.status(200).json({
      success: true,
      message: `Timesheet entry for '${empName}' with dateRange '${dateRange}' has been updated to '${updatedStatus}'.`,
      updatedTimesheetEntry,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        "Oops! There was an error while updating the timesheet entry status.",
    });
    console.error("Update Timesheet Status Error:", error);
  }
});

app.post("/onApproveOrRejectMultiple", async (req, res) => {
  try {
    const { dateRange, empNames, action } = req.body;

    if (!dateRange || !empNames || !action) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide 'dateRange', 'empNames' (an array), and 'action' in the request body.",
      });
    }

    const existingTimesheetEntries = await prisma.timesheetData.findMany({
      where: {
        dateRange: {
          equals: dateRange,
        },
        empName: {
          has: empNames,
        },
        status: {
          equals: "Pending",
        },
      },
    });

    if (!existingTimesheetEntries.length) {
      return res.status(404).json({
        success: false,
        message:
          "Timesheet entries not found or not in a pending state for the specified dateRange and empNames.",
      });
    }

    let updatedStatus;
    if (action === "Approve") {
      updatedStatus = "Approved";
    } else if (action === "Reject") {
      updatedStatus = "Rejected";
    } else {
      return res.status(400).json({
        success: false,
        message:
          "Invalid 'action' provided. It should be 'Approve' or 'Reject'.",
      });
    }

    const updatedTimesheetEntries = await prisma.timesheetData.updateMany({
      where: { id: { in: existingTimesheetEntries.map((entry) => entry.id) } },
      data: { status: updatedStatus },
    });

    res.status(200).json({
      success: true,
      message: `Timesheet entries for empNames '${empNames.join(
        ", "
      )}' with dateRange '${dateRange}' have been updated to '${updatedStatus}'.`,
      updatedTimesheetEntries,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        "Oops! There was an error while updating the timesheet entry status.",
    });
    console.error("Update Timesheet Status Error:", error);
  }
});

app.listen(port, () => {
  console.log("listening on port number", port);
});
