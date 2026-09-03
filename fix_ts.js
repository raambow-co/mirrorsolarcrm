const fs = require('fs');
const path = require('path');

function replaceInFile(filePath, searchVal, replaceVal) {
    const fullPath = path.join(__dirname, filePath);
    if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        fs.writeFileSync(fullPath, content.replace(searchVal, replaceVal));
    }
}

function replaceRegexInFile(filePath, regex, replaceVal) {
    const fullPath = path.join(__dirname, filePath);
    if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        fs.writeFileSync(fullPath, content.replace(regex, replaceVal));
    }
}

replaceRegexInFile('src/AccessPage.tsx', /AlertTriangle,\s*/, '');
replaceRegexInFile('src/dealer/DealerDashboard.tsx', /Calendar,\s*/, '');
replaceRegexInFile('src/dealer/DealerDashboard.tsx', /import type \{ STAGES \} from '\.\.\/context\/CRMContext';\n/, '');
replaceRegexInFile('src/dealer/DealerFollowupsPage.tsx', /,\s*Eye\s*\} from/, '} from');
replaceRegexInFile('src/dealer/DealerFollowupsPage.tsx', /FollowUpStatus,\s*/, '');
replaceRegexInFile('src/dealer/DealerProfilePage.tsx', /import \{ (.*?) \} from 'lucide-react';/, (match, p1) => `import { ${p1}, TrendingUp } from 'lucide-react';`);
replaceRegexInFile('src/dealer/DealerStockPage.tsx', /,\s*ArrowRight,\s*CheckCircle2\s*\} from/, '} from');
replaceRegexInFile('src/dealer/DealerStockPage.tsx', /import type \{ StockItem \} from '\.\.\/context\/StockContext';\n/, '');
replaceRegexInFile('src/employee/EmployeeDashboard.tsx', /import type \{ MockLead,\s*Stage\s*\} from '\.\.\/context\/CRMContext';\n/, '');
replaceRegexInFile('src/employee/EmployeeDashboard.tsx', /import type \{ STAGES \}/, 'import { STAGES }');
replaceRegexInFile('src/employee/EmployeeFollowupsPage.tsx', /FollowUpStatus,\s*/, '');
replaceRegexInFile('src/employee/EmployeeSidebar.tsx', /import \{ useCRM \} from '\.\.\/context\/CRMContext';\n/, '');
replaceRegexInFile('src/employee/EmployeeStockPage.tsx', /import type \{ StockItem \} from '\.\.\/context\/StockContext';\n/, '');
replaceRegexInFile('src/LeadsPage.tsx', /const handleConfirmStageChange = \(\) => \{\n    if \(selectedLead && newStageToSet\) \{\n      updateLeadStage\(selectedLead\.id, newStageToSet\);\n      setSelectedLead\(\{ \.\.\.selectedLead, stage: newStageToSet, updatedAt: 'Just now' \}\);\n      setIsStageModalOpen\(false\);\n    \}\n  \};\n/, '');

console.log("Done");
