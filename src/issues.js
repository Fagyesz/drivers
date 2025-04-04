const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const logger = require('./logger');

/**
 * Class for handling application issues and logs
 */
class IssueManager {
    constructor() {
        // Set up issues directory
        this.issuesDir = path.join(app.getPath('userData'), 'issues');
        
        // Create issues directory if it doesn't exist
        if (!fs.existsSync(this.issuesDir)) {
            fs.mkdirSync(this.issuesDir, { recursive: true });
        }
        
        logger.info('Issue manager initialized');
    }
    
    /**
     * Log an issue
     * @param {Object} issueData - Issue data
     * @returns {Object} Result of operation
     */
    async logIssue(issueData) {
        try {
            // Generate issue ID based on timestamp
            const issueId = `issue-${new Date().getTime()}`;
            
            // Create issue file
            const issueFilePath = path.join(this.issuesDir, `${issueId}.json`);
            
            // Include logs if requested
            let logs = '';
            if (issueData.includeLogs) {
                logs = logger.getRecentLogs(500);
            }
            
            // Save issue data
            const fullIssueData = {
                ...issueData,
                id: issueId,
                logs: logs,
                status: 'open'
            };
            
            fs.writeFileSync(
                issueFilePath, 
                JSON.stringify(fullIssueData, null, 2),
                { encoding: 'utf8' }
            );
            
            // Log the issue
            logger.info(`New issue reported: ${issueData.title}`, { issueId });
            
            return { success: true, issueId };
        } catch (error) {
            logger.error('Error logging issue:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Get all issues
     * @returns {Array<Object>} List of issues
     */
    getAllIssues() {
        try {
            // Get all issue files
            const issueFiles = fs.readdirSync(this.issuesDir)
                .filter(file => file.startsWith('issue-') && file.endsWith('.json'))
                .map(file => path.join(this.issuesDir, file));
            
            // Sort issue files by creation time (newest first)
            issueFiles.sort((a, b) => {
                return fs.statSync(b).birthtime.getTime() - fs.statSync(a).birthtime.getTime();
            });
            
            // Parse issue data
            const issues = issueFiles.map(file => {
                try {
                    const data = fs.readFileSync(file, { encoding: 'utf8' });
                    return JSON.parse(data);
                } catch (e) {
                    logger.error(`Error parsing issue file ${file}:`, e);
                    return null;
                }
            }).filter(issue => issue !== null);
            
            return issues;
        } catch (error) {
            logger.error('Error getting all issues:', error);
            return [];
        }
    }
    
    /**
     * Get issue by ID
     * @param {string} issueId - Issue ID
     * @returns {Object|null} Issue data or null if not found
     */
    getIssueById(issueId) {
        try {
            const issueFilePath = path.join(this.issuesDir, `${issueId}.json`);
            
            if (fs.existsSync(issueFilePath)) {
                const data = fs.readFileSync(issueFilePath, { encoding: 'utf8' });
                return JSON.parse(data);
            }
            
            return null;
        } catch (error) {
            logger.error(`Error getting issue ${issueId}:`, error);
            return null;
        }
    }
    
    /**
     * Update issue status
     * @param {string} issueId - Issue ID
     * @param {string} status - New status
     * @returns {Object} Result of operation
     */
    updateIssueStatus(issueId, status) {
        try {
            const issueFilePath = path.join(this.issuesDir, `${issueId}.json`);
            
            if (fs.existsSync(issueFilePath)) {
                const data = fs.readFileSync(issueFilePath, { encoding: 'utf8' });
                const issue = JSON.parse(data);
                
                issue.status = status;
                issue.updatedAt = new Date().toISOString();
                
                fs.writeFileSync(
                    issueFilePath, 
                    JSON.stringify(issue, null, 2),
                    { encoding: 'utf8' }
                );
                
                logger.info(`Issue ${issueId} status updated to ${status}`);
                
                return { success: true };
            }
            
            return { success: false, error: 'Issue not found' };
        } catch (error) {
            logger.error(`Error updating issue ${issueId}:`, error);
            return { success: false, error: error.message };
        }
    }
}

// Export issue manager instance
module.exports = new IssueManager(); 