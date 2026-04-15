def formatyear(self, theyear, m=3):
    for i, row in enumerate(self.yeardays2calendar(theyear, m)):
        names = (self.formatmonthname(theyear, k, colwidth, False) for k in months)
